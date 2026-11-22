// Costa Verde's living world: the player on foot and by car, traffic, pedestrians,
// the police who answer the wanted level, the five chained missions, combat,
// pickups, particles and the save.
import { CITY, DISTRICTS, PLAYER, CAR, WANTED, MISSIONS, SAVE_KEY } from './config.js';
import { buildCity, resolveCollision, blockedAt, isRoad } from './city.js';
import { angleDelta, angleTo, clamp, dist2, makeRng } from './random.js';

const DT = 1 / 60;

function makeCar(x, y, angle, kind, color, hp) {
  return {
    x, y, angle, speed: 0, hp: hp ?? CAR.trafficHp,
    kind, color, driven: false, honk: 0,
    // Traffic cars drive one road at a time.
    axis: 'x', dir: 1, lane: 18, turnAt: 0,
    stuck: 0, touchTimer: 0,
  };
}

export function createWorld(input, audio) {
  const city = buildCity(20261122);
  const rng = makeRng(20261122);

  const world = {
    city,
    state: 'title', // title | playing | paused | busted | wasted | win
    time: 0,
    frame: 0,
    camera: { x: 1500, y: 1300 },
    player: {
      x: 900, y: 620, angle: 0, vx: 0, vy: 0,
      hp: PLAYER.health, cash: PLAYER.startCash, ammo: PLAYER.startAmmo,
      inCar: null, aimAngle: 0, punchTimer: 0, shootTimer: 0, robTimer: 0,
    },
    cars: [],
    peds: [],
    pickups: [],
    particles: [],
    toasts: [],
    wanted: 0,
    wantedTimer: 0,
    missionIndex: 0,
    mission: null,
    missionTimer: 0,
    missionPhase: 0,
    missionDone: false,
    stats: { carsStolen: 0, missionsDone: 0, copsDodged: 0 },
    shot: null,
    shotFrames: 0,
    saveExists: false,
  };

  // ---- setup ---------------------------------------------------------------
  function spawnTraffic(count) {
    const colors = ['#d84a4a', '#4a7dd8', '#e0a32e', '#7d5fc0', '#3fae8a', '#c9c9c9', '#e07020'];
    for (let i = 0; i < count; i++) {
      const vertical = rng.next() < 0.5;
      let x, y, axis, dir;
      if (vertical) {
        const av = rng.pick(CITY.avenues);
        x = av + (rng.next() < 0.5 ? -18 : 18);
        y = rng.range(100, CITY.height - 100);
        axis = 'y';
        dir = rng.next() < 0.5 ? 1 : -1;
      } else {
        const st = rng.pick(CITY.streets);
        x = rng.range(100, CITY.width - 100);
        y = st + (rng.next() < 0.5 ? -18 : 18);
        axis = 'x';
        dir = rng.next() < 0.5 ? 1 : -1;
      }
      const car = makeCar(x, y, axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'traffic', rng.pick(colors), CAR.trafficHp);
      car.axis = axis;
      car.dir = dir;
      car.speed = rng.range(110, 170);
      car.lane = 18;
      world.cars.push(car);
    }
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i++) {
      let x, y, tries = 0;
      do {
        x = rng.range(80, CITY.width - 80);
        y = rng.range(80, CITY.bayTop - 80);
        tries++;
      } while (blockedAt(city, x, y) && tries < 12);
      world.peds.push({
        x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52),
        tx: x, ty: y, wait: rng.range(0, 3), color: rng.pick(['#e8c39e', '#8a5a3b', '#d8a0a0', '#a0b8d8', '#d8c9a0']),
      });
    }
  }

  function spawnParked() {
    const spots = [
      { x: 830, y: 620, color: '#3f7fd8', missionCar: true }, // mission 1 coupe, at the market kerb
      { x: 2770, y: 2100, color: '#e07020', getaway: true }, // mission 5 getaway car, kerbside off the avenue
      { x: 970, y: 1420, color: '#c9c9c9' },
      { x: 2170, y: 920, color: '#7d5fc0' },
      { x: 3370, y: 1650, color: '#3fae8a' },
      { x: 370, y: 920, color: '#d84a4a' },
      { x: 1570, y: 2150, color: '#e0a32e' },
    ];
    for (const s of spots) {
      const car = makeCar(s.x, s.y, rng.range(0, Math.PI * 2), 'parked', s.color, CAR.trafficHp);
      car.missionCar = !!s.missionCar;
      car.getaway = !!s.getaway;
      world.cars.push(car);
    }
  }

  function spawnPickups() {
    const kinds = ['cash', 'health', 'ammo'];
    for (let i = 0; i < 26; i++) {
      let x, y, tries = 0;
      do {
        x = rng.range(80, CITY.width - 80);
        y = rng.range(80, CITY.bayTop - 80);
        tries++;
      } while (blockedAt(city, x, y) && tries < 12);
      world.pickups.push({ x, y, kind: kinds[i % 3], bob: rng.range(0, Math.PI * 2) });
    }
  }

  spawnTraffic(26);
  spawnPeds(42);
  spawnParked();
  spawnPickups();

  // ---- helpers ---------------------------------------------------------------
  function toast(text, seconds) {
    world.toasts.push({ text, t: seconds || 4 });
    if (world.toasts.length > 3) world.toasts.shift();
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.3, speed);
      world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rng.range(0.25, 0.6), color });
    }
  }

  function addWanted(n) {
    if (n <= 0) return;
    const before = world.wanted;
    world.wanted = Math.min(WANTED.maxStars, world.wanted + n);
    world.wantedTimer = 0;
    if (world.wanted > before) toast(`Wanted level ${world.wanted} star${world.wanted > 1 ? 's' : ''} — the police are coming`, 3);
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of world.cars) {
      if (kinds && !kinds.includes(car.kind)) continue;
      if (car.driven) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  // ---- missions ---------------------------------------------------------------
  function currentMission() {
    return MISSIONS[world.missionIndex] || null;
  }

  function startMission(index) {
    world.missionIndex = index;
    world.mission = currentMission();
    world.missionPhase = 0;
    world.missionTimer = world.mission && world.mission.timer ? world.mission.timer : 0;
    world.missionDone = false;
    if (world.mission) {
      toast(`${world.mission.name} — ${world.mission.giver}: ${world.mission.briefing}`, 7);
      if (world.mission.id === 4) {
        world.wanted = Math.max(1, world.wanted);
      }
    }
  }

  function completeMission() {
    const m = world.mission;
    if (!m) return;
    world.player.cash += m.reward;
    world.stats.missionsDone++;
    world.missionDone = true;
    audio.missionDone();
    burst(world.player.x, world.player.y, '#f2c230', 26, 260);
    toast(`${m.name} complete! +$${m.reward}`, 4);
    saveGame();
    if (world.missionIndex >= MISSIONS.length - 1) {
      world.state = 'win';
      return;
    }
    setTimeout(() => {
      if (world.state === 'playing') startMission(world.missionIndex + 1);
    }, 1200);
  }

  function failMission(text) {
    toast(text, 4);
    if (world.mission && world.mission.id === 3) {
      world.missionTimer = world.mission.timer;
      toast('Hot Delivery failed — try again. The package is still waiting.', 4);
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        missionIndex: world.missionIndex,
        cash: world.player.cash,
      }));
      world.saveExists = true;
    } catch { /* storage is best-effort */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.missionIndex !== 'number') return false;
      world.missionIndex = Math.min(data.missionIndex, MISSIONS.length - 1);
      world.player.cash = data.cash || PLAYER.startCash;
      world.saveExists = true;
      return true;
    } catch {
      return false;
    }
  }

  // ---- police ---------------------------------------------------------------
  function spawnPolice() {
    const wantCars = WANTED.policeCars[world.wanted] || 0;
    const wantFoot = WANTED.footCops[world.wanted] || 0;
    const haveCars = world.cars.filter((c) => c.kind === 'police').length;
    const haveFoot = world.peds.filter((p) => p.cop).length;
    const px = world.player.x;
    const py = world.player.y;
    for (let i = haveCars; i < wantCars; i++) {
      // Spawn on a road near the player, off-screen if possible.
      const av = rng.pick(CITY.avenues);
      const st = rng.pick(CITY.streets);
      const x = clamp(px + (rng.next() < 0.5 ? -900 : 900), 120, CITY.width - 120);
      const car = makeCar(x, st, 0, 'police', '#2e5fd8', CAR.policeHp);
      car.speed = 300;
      world.cars.push(car);
      void av;
    }
    for (let i = haveFoot; i < wantFoot; i++) {
      world.peds.push({
        x: clamp(px + (rng.next() < 0.5 ? -500 : 500), 60, CITY.width - 60),
        y: clamp(py + (rng.next() < 0.5 ? -400 : 400), 60, CITY.bayTop - 60),
        angle: 0, speed: 200, tx: px, ty: py, wait: 0,
        color: '#2e5fd8', cop: true, touchTimer: 0,
      });
    }
  }

  function policeCanSeePlayer() {
    const px = world.player.x;
    const py = world.player.y;
    for (const car of world.cars) {
      if (car.kind !== 'police') continue;
      if (dist2(px, py, car.x, car.y) < 520 * 520) return true;
    }
    for (const p of world.peds) {
      if (p.cop && dist2(px, py, p.x, p.y) < 420 * 420) return true;
    }
    return false;
  }

  // ---- combat ---------------------------------------------------------------
  function shootAt(wx, wy) {
    const p = world.player;
    if (p.shootTimer > 0 || p.ammo <= 0) return;
    p.shootTimer = 0.28;
    p.ammo--;
    p.aimAngle = angleTo(p.x, p.y, wx, wy);
    audio.shoot();
    burst(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22, '#ffd76a', 5, 200);
    addWanted(1);
    // Hit the nearest cop, ped or car roughly along the aim line.
    let best = null;
    let bestD = PLAYER.gunRange;
    const targets = [];
    for (const ped of world.peds) if (ped.cop) targets.push({ x: ped.x, y: ped.y, r: 14, hit: () => hurtCop(ped) });
    for (const car of world.cars) {
      if (car.kind === 'police') targets.push({ x: car.x, y: car.y, r: 24, hit: () => hurtCar(car, PLAYER.gunDamage) });
    }
    for (const t of targets) {
      const d = Math.sqrt(dist2(p.x, p.y, t.x, t.y));
      if (d > PLAYER.gunRange) continue;
      const ang = angleTo(p.x, p.y, t.x, t.y);
      if (Math.abs(angleDelta(p.aimAngle, ang)) < 0.22 && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) best.hit();
  }

  function hurtCop(ped) {
    ped.hp = (ped.hp ?? 100) - PLAYER.gunDamage;
    burst(ped.x, ped.y, '#ff5d5d', 8, 160);
    if (ped.hp <= 0) {
      world.peds.splice(world.peds.indexOf(ped), 1);
      world.player.cash += 20;
      addWanted(1);
    }
  }

  function hurtCar(car, damage) {
    car.hp -= damage;
    burst(car.x, car.y, '#ffb03a', 8, 180);
    if (car.hp <= 0) {
      burst(car.x, car.y, '#ff7a1a', 30, 320);
      audio.crash();
      const idx = world.cars.indexOf(car);
      if (idx >= 0) world.cars.splice(idx, 1);
      if (car === world.player.inCar) {
        world.player.inCar = null;
        world.player.hp -= 20;
      }
      addWanted(1);
    }
  }

  function punch() {
    const p = world.player;
    if (p.punchTimer > 0) return;
    p.punchTimer = 0.4;
    audio.punch();
    for (const ped of [...world.peds]) {
      const d = Math.sqrt(dist2(p.x, p.y, ped.x, ped.y));
      if (d > PLAYER.punchRange) continue;
      const ang = angleTo(p.x, p.y, ped.x, ped.y);
      if (Math.abs(angleDelta(p.angle, ang)) > PLAYER.punchArc) continue;
      if (ped.cop) {
        hurtCop(ped);
      } else {
        burst(ped.x, ped.y, '#ffffff', 6, 140);
        world.peds.splice(world.peds.indexOf(ped), 1);
        addWanted(1);
      }
    }
  }

  // ---- per-frame updates ---------------------------------------------------------------
  function updatePlayer(dt) {
    const p = world.player;
    p.punchTimer = Math.max(0, p.punchTimer - dt);
    p.shootTimer = Math.max(0, p.shootTimer - dt);
    if (p.inCar) {
      updateDriving(dt);
      return;
    }
    const axes = input.walkAxes();
    p.vx += axes.x * PLAYER.accel * dt;
    p.vy += axes.y * PLAYER.accel * dt;
    const damp = Math.exp(-8 * dt);
    p.vx *= damp;
    p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER.walkSpeed) {
      p.vx = (p.vx / speed) * PLAYER.walkSpeed;
      p.vy = (p.vy / speed) * PLAYER.walkSpeed;
    }
    if (speed > 20) p.angle = Math.atan2(p.vy, p.vx);
    let pos = resolveCollision(city, p.x + p.vx * dt, p.y + p.vy * dt, PLAYER.radius);
    p.x = pos.x;
    p.y = pos.y;
    // Enter a car — unless the bank robbery is in progress, where holding E
    // belongs to the robbery, not to stealing a passing car.
    if (input.consume('e')) {
      const robbing = world.mission && world.mission.id === 5 && world.missionPhase === 1;
      if (robbing) {
        toast('Keep holding E to rob the bank!', 2);
      } else {
        const car = nearestCar(p.x, p.y, 56, ['parked', 'traffic']);
        if (car) {
          p.inCar = car;
          car.driven = true;
          car.kind = 'hero';
          world.stats.carsStolen++;
          addWanted(1);
          audio.pickup();
          toast('You took the car. The law noticed.', 3);
        }
      }
    }
    if (input.consume(' ')) punch();
    if (input.consumeClick()) {
      const wx = world.camera.x - 640 + input.mouse.x;
      const wy = world.camera.y - 400 + input.mouse.y;
      shootAt(wx, wy);
    }
  }

  function updateDriving(dt) {
    const p = world.player;
    const car = p.inCar;
    const { steer, throttle } = input.driveAxes();
    const forward = throttle > 0 ? 1 : throttle < 0 ? -1 : 0;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 30) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed *= Math.exp(-1.2 * dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const turn = steer * CAR.steerRate * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.angle += turn * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const pos = resolveCollision(city, nx, ny, 22);
    if (Math.abs(pos.x - nx) > 0.5 || Math.abs(pos.y - ny) > 0.5) {
      if (Math.abs(car.speed) > 200) {
        car.hp -= 12;
        audio.crash();
        burst(car.x, car.y, '#ffb03a', 10, 200);
        addWanted(0);
      }
      car.speed *= 0.4;
    }
    car.x = pos.x;
    car.y = pos.y;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    void forward;
    if (car.hp <= 0) {
      hurtCar(car, 0);
      if (world.player.inCar === car) world.player.inCar = null;
      return;
    }
    if (input.consume('e')) {
      car.driven = false;
      car.speed = 0;
      car.kind = 'parked';
      p.inCar = null;
      const side = car.angle + Math.PI / 2;
      const pos2 = resolveCollision(city, car.x + Math.cos(side) * 34, car.y + Math.sin(side) * 34, PLAYER.radius);
      p.x = pos2.x;
      p.y = pos2.y;
    }
    if (input.consumeClick()) {
      const wx = world.camera.x - 640 + input.mouse.x;
      const wy = world.camera.y - 400 + input.mouse.y;
      shootAt(wx, wy);
    }
  }

  function updateTraffic(dt) {
    for (const car of world.cars) {
      if (car.kind !== 'traffic') continue;
      car.speed = clamp(car.speed, 110, 180);
      // Turn at intersections sometimes, and never leave the road grid: when a
      // car turns, snap it onto the crossing road first, so it never cuts a
      // corner across a city block.
      const onAvenue = CITY.avenues.some((ax) => Math.abs(car.x - ax) < 30);
      const onStreet = CITY.streets.some((sy) => Math.abs(car.y - sy) < 30);
      if (onAvenue && onStreet && rng.next() < 0.006) {
        if (car.axis === 'x') {
          car.axis = 'y';
          car.dir = rng.next() < 0.5 ? 1 : -1;
          car.x = CITY.avenues.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a));
        } else {
          car.axis = 'x';
          car.dir = rng.next() < 0.5 ? 1 : -1;
          car.y = CITY.streets.reduce((a, b) => (Math.abs(car.y - b) < Math.abs(car.y - a) ? b : a));
        }
      }
      if (car.axis === 'x') {
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.y += (car.dir > 0 ? 0 : 0);
        car.x += car.dir * car.speed * dt;
        // Keep the car on its street lane.
        const street = CITY.streets.reduce((a, b) => (Math.abs(car.y - b) < Math.abs(car.y - a) ? b : a));
        car.y += (street + car.lane * (car.dir > 0 ? 1 : -1) - car.y) * Math.min(1, 3 * dt);
        if (car.x < 60) car.x = CITY.width - 60;
        if (car.x > CITY.width - 60) car.x = 60;
      } else {
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.y += car.dir * car.speed * dt;
        const avenue = CITY.avenues.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a));
        car.x += (avenue + car.lane * (car.dir > 0 ? -1 : 1) - car.x) * Math.min(1, 3 * dt);
        if (car.y < 60) car.y = CITY.height - 60;
        if (car.y > CITY.height - 60) car.y = 60;
      }
    }
    // Car-car bumps: push apart, damage on hard hits.
    for (let i = 0; i < world.cars.length; i++) {
      for (let j = i + 1; j < world.cars.length; j++) {
        const a = world.cars[i];
        const b = world.cars[j];
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 > 42 * 42 || d2 < 0.01) continue;
        const d = Math.sqrt(d2);
        const push = (42 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 140) {
          a.hp -= 8;
          b.hp -= 8;
          if (a === world.player.inCar || b === world.player.inCar) {
            audio.crash();
            burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffb03a', 8, 160);
          }
          a.speed *= 0.6;
          b.speed *= 0.6;
        }
      }
    }
    // Wrecked traffic cars vanish in a puff.
    for (const car of [...world.cars]) {
      if (car.kind === 'traffic' && car.hp <= 0) {
        burst(car.x, car.y, '#ff7a1a', 22, 280);
        world.cars.splice(world.cars.indexOf(car), 1);
      }
    }
  }

  function updatePolice(dt) {
    const p = world.player;
    spawnPolice();
    for (const car of world.cars) {
      if (car.kind !== 'police') continue;
      const target = angleTo(car.x, car.y, p.x, p.y);
      car.angle += clamp(angleDelta(car.angle, target), -2.4 * dt, 2.4 * dt);
      car.speed = clamp(car.speed + 260 * dt, 0, 480);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const pos = resolveCollision(city, car.x, car.y, 22);
      if (Math.abs(pos.x - car.x) > 0.5 || Math.abs(pos.y - car.y) > 0.5) {
        car.speed *= 0.5;
        car.angle += 0.6;
      }
      car.x = pos.x;
      car.y = pos.y;
      // Ramming the player's car hurts it.
      if (p.inCar && dist2(car.x, car.y, p.inCar.x, p.inCar.y) < 40 * 40) {
        p.inCar.hp -= 26 * dt * 10;
        if (Math.abs(p.inCar.speed) > 60) audio.crash();
      }
      // A police car next to a walking player busts them.
      if (!p.inCar && dist2(car.x, car.y, p.x, p.y) < 46 * 46) {
        car.touchTimer = (car.touchTimer || 0) + dt;
        if (car.touchTimer > 0.9) {
          world.state = 'busted';
          audio.busted();
          return;
        }
      } else {
        car.touchTimer = 0;
      }
    }
    for (const ped of [...world.peds]) {
      if (!ped.cop) continue;
      const target = angleTo(ped.x, ped.y, p.x, p.y);
      ped.angle = target;
      ped.x += Math.cos(target) * ped.speed * dt;
      ped.y += Math.sin(target) * ped.speed * dt;
      const pos = resolveCollision(city, ped.x, ped.y, 12);
      ped.x = pos.x;
      ped.y = pos.y;
      if (!p.inCar && dist2(ped.x, ped.y, p.x, p.y) < 26 * 26) {
        ped.touchTimer = (ped.touchTimer || 0) + dt;
        if (ped.touchTimer > 0.8) {
          world.state = 'busted';
          audio.busted();
          return;
        }
      } else {
        ped.touchTimer = 0;
      }
    }
    // Wanted decay: slower while a cop can see the player.
    if (world.wanted > 0) {
      world.wantedTimer += dt;
      const limit = policeCanSeePlayer() ? WANTED.decaySeconds : WANTED.hiddenDecaySeconds;
      if (world.wantedTimer >= limit) {
        world.wanted--;
        world.wantedTimer = 0;
        if (world.wanted === 0) {
          toast('You lost the heat. Breathe, Marco.', 3);
          world.stats.copsDodged++;
          // Cops give up.
          for (const car of [...world.cars]) if (car.kind === 'police') world.cars.splice(world.cars.indexOf(car), 1);
          for (const ped of [...world.peds]) if (ped.cop) world.peds.splice(world.peds.indexOf(ped), 1);
        }
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of world.peds) {
      if (ped.cop) continue;
      if (ped.wait > 0) {
        ped.wait -= dt;
        continue;
      }
      const d = Math.sqrt(dist2(ped.x, ped.y, ped.tx, ped.ty));
      if (d < 12) {
        // Pick a new nearby stroll target on a road or sidewalk.
        const av = rng.pick(CITY.avenues);
        const st = rng.pick(CITY.streets);
        if (rng.next() < 0.5) {
          ped.tx = clamp(av + rng.range(-140, 140), 60, CITY.width - 60);
          ped.ty = clamp(st + rng.range(-50, 50), 60, CITY.bayTop - 60);
        } else {
          ped.tx = clamp(ped.x + rng.range(-260, 260), 60, CITY.width - 60);
          ped.ty = clamp(ped.y + rng.range(-200, 200), 60, CITY.bayTop - 60);
        }
        ped.wait = rng.range(0, 2);
        continue;
      }
      ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      const pos = resolveCollision(city, nx, ny, 10);
      ped.x = pos.x;
      ped.y = pos.y;
      // Run over by a car: the law notices, the pedestrian does not get up.
      if (world.player.inCar && Math.abs(world.player.inCar.speed) > 80) {
        const car = world.player.inCar;
        if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26) {
          burst(ped.x, ped.y, '#ff5d5d', 10, 180);
          world.peds.splice(world.peds.indexOf(ped), 1);
          addWanted(1);
        }
      }
    }
  }

  function updatePickups(dt) {
    const p = world.player;
    for (const pk of [...world.pickups]) {
      pk.bob += dt * 3;
      if (dist2(p.x, p.y, pk.x, pk.y) > 30 * 30) continue;
      world.pickups.splice(world.pickups.indexOf(pk), 1);
      if (pk.kind === 'cash') {
        p.cash += 75;
        audio.coin();
        toast('+$75', 2);
      } else if (pk.kind === 'health') {
        p.hp = Math.min(PLAYER.health, p.hp + 30);
        audio.pickup();
        toast('+30 health', 2);
      } else {
        p.ammo += 12;
        audio.pickup();
        toast('+12 ammo', 2);
      }
      burst(pk.x, pk.y, '#f2c230', 10, 160);
    }
  }

  function updateMission(dt) {
    const m = world.mission;
    if (!m || world.missionDone) return;
    const p = world.player;
    if (m.timer && world.missionTimer > 0) {
      world.missionTimer -= dt;
      if (world.missionTimer <= 0) {
        world.missionTimer = 0;
        failMission('Out of time!');
        return;
      }
    }
    const tx = m.target.x;
    const ty = m.target.y;
    const near = dist2(p.x, p.y, tx, ty) < 44 * 44;
    if (m.id === 1) {
      if (p.inCar) completeMission();
    } else if (m.id === 2 || m.id === 3) {
      if (near) completeMission();
    } else if (m.id === 4) {
      if (world.wanted === 0) completeMission();
    } else if (m.id === 5) {
      if (world.missionPhase === 0) {
        if (near) {
          world.missionPhase = 1;
          toast('Hold E at the counter to rob the bank!', 4);
        }
      } else if (world.missionPhase === 1) {
        if (!near) {
          world.missionPhase = 0;
          p.robTimer = 0;
        } else if (input.down('e')) {
          p.robTimer += dt;
          if (p.robTimer >= 2) {
            world.missionPhase = 2;
            p.cash += 1200;
            addWanted(3);
            audio.coin();
            toast('You grabbed the vault cash! Get to the orange getaway car!', 5);
          }
        } else {
          p.robTimer = Math.max(0, p.robTimer - dt * 2);
        }
      } else if (world.missionPhase === 2) {
        // Escape in the orange getaway car itself.
        if (p.inCar && p.inCar.getaway) completeMission();
      }
    }
  }

  function updateCamera(dt) {
    const tx = clamp(world.player.x, 640, CITY.width - 640);
    const ty = clamp(world.player.y, 400, CITY.height - 400);
    const k = Math.min(1, 5 * dt);
    world.camera.x += (tx - world.camera.x) * k;
    world.camera.y += (ty - world.camera.y) * k;
  }

  function updateAmbient(dt) {
    updateTraffic(dt);
    updatePeds(dt);
    for (const pk of world.pickups) pk.bob += dt * 3;
  }

  // ---- public API ---------------------------------------------------------------
  world.startGame = function (fresh) {
    if (fresh) {
      world.missionIndex = 0;
      world.player.cash = PLAYER.startCash;
      world.player.hp = PLAYER.health;
      world.player.ammo = PLAYER.startAmmo;
      world.wanted = 0;
      try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      world.saveExists = false;
    } else {
      loadGame();
    }
    world.player.x = 900;
    world.player.y = 620;
    world.player.hp = PLAYER.health;
    world.player.inCar = null;
    world.state = 'playing';
    startMission(world.missionIndex);
    audio.unlock();
    audio.startMusic();
  };

  world.toTitle = function () {
    world.state = 'title';
    world.player.inCar = null;
  };

  world.update = function (dt) {
    world.time += dt;
    world.frame++;
    for (const pt of world.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    world.particles = world.particles.filter((pt) => pt.life > 0);
    for (const t of world.toasts) t.t -= dt;
    world.toasts = world.toasts.filter((t) => t.t > 0);

    if (world.state === 'title') {
      // The city lives behind the title screen.
      updateAmbient(dt);
      world.camera.x = 1500 + Math.sin(world.time * 0.05) * 500;
      world.camera.y = 1300 + Math.cos(world.time * 0.04) * 300;
      return;
    }
    if (world.state !== 'playing') return;

    if (input.consume('Escape') || input.consume('p')) {
      world.state = 'paused';
      return;
    }
    if (input.consume('m')) {
      const muted = audio.toggleMute();
      toast(muted ? 'Sound off' : 'Sound on', 2);
    }

    updatePlayer(dt);
    if (world.state !== 'playing') return;
    updateTraffic(dt);
    updatePolice(dt);
    if (world.state !== 'playing') return;
    updatePeds(dt);
    updatePickups(dt);
    updateMission(dt);
    updateCamera(dt);

    const driving = !!world.player.inCar;
    const speed01 = driving ? Math.abs(world.player.inCar.speed) / CAR.maxSpeed : 0;
    audio.setEngine(speed01, driving);
    audio.siren(world.wanted > 0, world.time);

    if (world.player.hp <= 0) {
      world.state = 'wasted';
      audio.busted();
    }
  };

  world.missionTarget = function () {
    const m = world.mission;
    if (!m) return null;
    if (m.id === 5 && world.missionPhase === 2) {
      return { x: 2770, y: 2100, label: 'Getaway car' };
    }
    return m.target;
  };

  world.districtName = function () {
    const d = DISTRICTS.find((dd) => world.player.x >= dd.x0 && world.player.x < dd.x1 && world.player.y >= dd.y0 && world.player.y < dd.y1);
    return d ? d.name : 'Costa Verde';
  };

  world.fixedStep = DT;
  world.loadSaveOnBoot = loadGame;
  loadGame();
  startMission(world.missionIndex);
  return world;
}
