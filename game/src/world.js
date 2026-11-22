// Costa Verde's living world: the player on foot and in cars, traffic and
// pedestrians, the police and the wanted level, five story missions, combat,
// pickups and the save. One update() step moves everything.

import { WORLD, TUNING, MISSIONS, PALETTE, AVENUES, STREETS, ROAD_W } from './config.js';
import { generateCity, isOnRoad, nearestAvenue, nearestStreet, resolveCollision, inWater } from './city.js';
import { makeRng, clamp, angleDiff, dist2 } from './random.js';

export function createWorld(seed, audio) {
  const rng = makeRng(seed);
  const city = generateCity(seed);

  const state = {
    seed, city, rng, audio,
    mode: 'title', // title | playing | paused | busted | wasted | win
    time: 0,
    cash: 0,
    health: TUNING.maxHealth,
    wanted: 0,
    wantedTimer: 0,
    bustedTimer: 0,
    missionIndex: 0,
    mission: null,
    message: '',
    messageTimer: 0,
    camera: { x: 1800, y: 1400, shake: 0 },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    stats: { stolen: 0, missions: 0, busts: 0, wasted: 0, shots: 0 },
    best: 0,
    muted: false,
    saveLoaded: false,
  };

  const player = {
    x: 600, y: 1300, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null, weapon: 'pistol', ammo: TUNING.pistolAmmoStart,
    punchCooldown: 0, shootCooldown: 0, invuln: 0,
  };
  state.player = player;

  // --- Spawning -----------------------------------------------------------

  function spawnTrafficCar() {
    const vertical = rng.chance(0.5);
    let x, y, angle;
    if (vertical) {
      const ax = rng.pick(AVENUES);
      x = ax + (rng.chance(0.5) ? -22 : 22);
      y = rng.range(150, WORLD.h - 150);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const sy = rng.pick(STREETS);
      y = sy + (rng.chance(0.5) ? -22 : 22);
      x = rng.range(150, WORLD.w - 150);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    return {
      id: state.cars.length + 1, kind: 'traffic', x, y, angle,
      speed: rng.range(100, 150), maxSpeed: rng.range(110, 160),
      color: rng.pick(PALETTE.car), hp: 60, driver: true,
      vertical, turnCooldown: rng.range(1, 4), siren: false, stuck: 0,
    };
  }

  function spawnParkedCar() {
    const vertical = rng.chance(0.5);
    let x, y, angle;
    if (vertical) {
      const ax = rng.pick(AVENUES);
      x = ax + (rng.chance(0.5) ? -34 : 34);
      y = rng.range(200, WORLD.h - 200);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const sy = rng.pick(STREETS);
      y = sy + (rng.chance(0.5) ? -34 : 34);
      x = rng.range(200, WORLD.w - 200);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    return {
      id: state.cars.length + 1, kind: 'parked', x, y, angle,
      speed: 0, maxSpeed: 0, color: rng.pick(PALETTE.car),
      hp: 60, driver: false, vertical, turnCooldown: 0, siren: false, stuck: 0,
    };
  }

  function spawnPed(x, y) {
    const onRoad = isOnRoad(city, x, y);
    return {
      x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(40, 65),
      kind: rng.chance(0.06) ? 'cop' : 'civilian',
      color: rng.pick(['#e8e0d0', '#c9a86a', '#7a9e7e', '#9e7a8a', '#6a7a9e', '#d9d9d9']),
      state: 'walk', stateTimer: rng.range(2, 6), fleeX: 0, fleeY: 0,
      hp: 30, down: false, downTimer: 0, onRoad,
    };
  }

  function spawnPickup(kind) {
    const vertical = rng.chance(0.5);
    let x, y;
    if (vertical) {
      x = rng.pick(AVENUES) + rng.range(-30, 30);
      y = rng.range(200, WORLD.h - 300);
    } else {
      x = rng.range(200, WORLD.w - 200);
      y = rng.pick(STREETS) + rng.range(-30, 30);
    }
    return { x, y, kind, bob: rng.range(0, Math.PI * 2) };
  }

  for (let i = 0; i < 26; i++) state.cars.push(spawnTrafficCar());
  for (let i = 0; i < 14; i++) state.cars.push(spawnParkedCar());
  for (let i = 0; i < 42; i++) {
    state.peds.push(spawnPed(rng.range(200, WORLD.w - 200), rng.range(200, WORLD.h - 300)));
  }
  for (let i = 0; i < 6; i++) state.pickups.push(spawnPickup('cash'));
  for (let i = 0; i < 3; i++) state.pickups.push(spawnPickup('health'));
  for (let i = 0; i < 3; i++) state.pickups.push(spawnPickup('ammo'));

  // --- Helpers ------------------------------------------------------------

  function say(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 4;
  }

  function addWanted(n, reason) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, TUNING.maxWanted);
    if (state.wanted > before) say(reason + ` — wanted level ${state.wanted}`, 3);
    state.wantedTimer = 0;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rng.range(0.3, 0.8), maxLife: 0.8, color, size: rng.range(2, 5),
      });
    }
  }

  function nearestCar(x, y, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const c of state.cars) {
      if (c === player.car) continue;
      const d = dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // --- Missions -----------------------------------------------------------

  function startMission(index) {
    const def = MISSIONS[index];
    if (!def) { state.mode = 'win'; state.best = Math.max(state.best, state.cash); save(); return; }
    state.mission = {
      def, stage: 0, timer: def.timeLimit || 0, target: { ...def.target },
      done: false,
    };
    if (def.wantedOnStart) { state.wanted = Math.max(state.wanted, def.wantedOnStart); }
    say(`Mission ${def.id}: ${def.name} — ${def.brief}`, 6);
    audio.missionDone();
  }

  function completeMission() {
    const m = state.mission;
    if (!m || m.done) return;
    m.done = true;
    state.cash += m.def.reward;
    state.stats.missions++;
    say(`Mission complete: ${m.def.name} — +$${m.def.reward}`, 5);
    audio.missionDone();
    burst(player.x, player.y, '#f2c200', 40, 260);
    save();
    setTimeout(() => {
      if (state.mode !== 'playing') return;
      state.missionIndex++;
      if (state.missionIndex >= MISSIONS.length) {
        state.mode = 'win';
        state.best = Math.max(state.best, state.cash);
        save();
      } else {
        startMission(state.missionIndex);
      }
    }, 2600);
  }

  function failMission(reason) {
    say(reason + ' — mission restarted', 4);
    startMission(state.missionIndex);
  }

  function updateMission(dt) {
    const m = state.mission;
    if (!m || m.done) return;
    const def = m.def;
    const dx = player.x - m.target.x, dy = player.y - m.target.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (def.kind === 'driveTo') {
      if (!player.onFoot && d < 100) completeMission();
    } else if (def.kind === 'walkTo') {
      if (player.onFoot && d < 80) completeMission();
    } else if (def.kind === 'timedDrive') {
      m.timer -= dt;
      if (!player.onFoot && d < 100) { completeMission(); return; }
      if (m.timer <= 0) failMission('Too slow — the drop went cold');
    } else if (def.kind === 'loseHeat') {
      if (m.stage === 0) {
        if (state.wanted === 0) { m.stage = 1; say('Heat is off. Now reach the hideout.', 4); }
      } else if (d < 100) completeMission();
    } else if (def.kind === 'heist') {
      if (m.stage === 0) {
        if (player.onFoot && d < 90) {
          m.stage = 1;
          state.cash += 800;
          say('Vault cash grabbed! +$800 — now run!', 4);
          state.wanted = 3;
          burst(player.x, player.y, '#f2c200', 50, 300);
          audio.missionDone();
        }
      } else if (d < 100) completeMission();
      if (m.stage === 1) {
        // The hideout is the target once the cash is grabbed.
        m.target = { ...city.places.hideout };
      }
    }
  }

  // --- Save / load --------------------------------------------------------

  function save() {
    try {
      localStorage.setItem(TUNING.saveKey, JSON.stringify({
        cash: state.cash, missionIndex: state.missionIndex, best: state.best,
      }));
    } catch { /* storage unavailable — the game still plays */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(TUNING.saveKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      state.cash = s.cash || 0;
      state.missionIndex = Math.min(s.missionIndex || 0, MISSIONS.length - 1);
      state.best = s.best || 0;
      state.saveLoaded = true;
      return true;
    } catch { return false; }
  }

  // --- Player -------------------------------------------------------------

  function updatePlayer(dt, input) {
    const p = player;
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.shootCooldown = Math.max(0, p.shootCooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    if (p.onFoot) {
      let mx = 0, my = 0;
      if (input.up) my -= 1;
      if (input.down) my += 1;
      if (input.left) mx -= 1;
      if (input.right) mx += 1;
      const len = Math.hypot(mx, my) || 1;
      const run = input.run ? TUNING.playerRunSpeed : TUNING.playerWalkSpeed;
      const vx = (mx / len) * run * (mx || my ? 1 : 0);
      const vy = (my / len) * run * (mx || my ? 1 : 0);
      const next = resolveCollision(city, p.x + vx * dt, p.y + vy * dt, 14);
      p.x = next.x; p.y = next.y;
      if (mx || my) p.angle = Math.atan2(vy, vx);
      p.speed = Math.hypot(vx, vy);
      // Enter a car.
      if (input.enter) {
        input.enter = false;
        const car = nearestCar(p.x, p.y, 70);
        if (car) {
          p.car = car;
          p.onFoot = false;
          car.kind = 'player';
          if (car.driver) {
            car.driver = false;
            state.peds.push(spawnPed(car.x + 30, car.y + 30));
            const fled = state.peds[state.peds.length - 1];
            fled.state = 'flee'; fled.stateTimer = 3;
            fled.fleeX = p.x; fled.fleeY = p.y;
            state.stats.stolen++;
            addWanted(1, 'Car stolen');
            audio.horn();
          } else {
            say('You took the car', 2);
          }
          p.angle = car.angle;
        }
      }
      // Punch.
      if (input.punch && p.punchCooldown <= 0) {
        p.punchCooldown = 0.45;
        audio.punch();
        for (const ped of state.peds) {
          if (ped.down) continue;
          const d = Math.hypot(ped.x - p.x, ped.y - p.y);
          if (d < 52 && Math.abs(angleDiff(p.angle, Math.atan2(ped.y - p.y, ped.x - p.x))) < 1.1) {
            damagePed(ped, TUNING.punchDamage, p.x, p.y);
            break;
          }
        }
      }
      // Shoot toward the mouse.
      if (input.shoot && p.shootCooldown <= 0 && p.ammo > 0) {
        p.shootCooldown = 0.22;
        p.ammo--;
        state.stats.shots++;
        const a = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
        state.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, angle: a, speed: 900, life: 0.7, from: 'player' });
        burst(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24, '#ffd76a', 4, 120);
        audio.shoot();
        if (state.wanted === 0) addWanted(1, 'Shots fired');
      }
    } else {
      // Driving.
      const car = p.car;
      if (!car) { p.onFoot = true; return; }
      const forward = input.up ? 1 : input.down ? -0.6 : 0;
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      car.speed += forward * TUNING.carAccel * dt;
      car.speed *= Math.pow(0.4, dt); // drag
      car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
      if (Math.abs(car.speed) > 20) {
        car.angle += steer * TUNING.carTurn * dt * (car.speed / TUNING.carMaxSpeed) * (car.speed < 0 ? -1 : 1);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = resolveCollision(city, nx, ny, 22);
      if (hit.x !== nx || hit.y !== ny) {
        if (Math.abs(car.speed) > 140) {
          audio.crash();
          burst(car.x, car.y, '#ffb347', 12, 200);
          state.camera.shake = 6;
          car.hp -= 12;
          if (car.hp <= 0) explodeCar(car);
        }
        car.speed *= 0.4;
      }
      car.x = hit.x; car.y = hit.y;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
      // Keep cars from visually overlapping: nudge the player's car out of
      // any other car it touches, and slow them both a touch.
      for (const other of state.cars) {
        if (other === car) continue;
        const dx = car.x - other.x, dy = car.y - other.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 42) {
          const push = (42 - d) / 2;
          const ux = dx / d, uy = dy / d;
          const spot = resolveCollision(city, car.x + ux * push, car.y + uy * push, 22);
          car.x = spot.x; car.y = spot.y;
          p.x = car.x; p.y = car.y;
          car.speed *= 0.94;
          other.speed *= 0.9;
        }
      }
      // Car vs pedestrians.
      for (const ped of state.peds) {
        if (ped.down) continue;
        const d = Math.hypot(ped.x - car.x, ped.y - car.y);
        if (d < 30 && Math.abs(car.speed) > 60) {
          damagePed(ped, 100, car.x, car.y);
          addWanted(1, 'Pedestrian hit');
          audio.crash();
        }
      }
      // Exit the car.
      if (input.enter) {
        input.enter = false;
        const ex = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
        const ey = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
        const spot = resolveCollision(city, ex, ey, 14);
        p.x = spot.x; p.y = spot.y;
        p.onFoot = true;
        car.kind = 'parked';
        car.speed = 0;
        p.car = null;
      }
      audio.setEngine(Math.abs(car.speed) / TUNING.carMaxSpeed, true);
    }
  }

  function damagePed(ped, dmg, fromX, fromY) {
    ped.hp -= dmg;
    if (ped.hp <= 0 && !ped.down) {
      ped.down = true;
      ped.downTimer = 4;
      burst(ped.x, ped.y, '#c94f3d', 14, 160);
      if (ped.kind === 'cop') {
        addWanted(2, 'Officer down');
      } else if (state.wanted === 0 && dmg >= TUNING.punchDamage) {
        addWanted(1, 'Assault');
      }
    } else if (!ped.down) {
      ped.state = 'flee';
      ped.stateTimer = 2.5;
      ped.fleeX = fromX; ped.fleeY = fromY;
    }
  }

  function explodeCar(car) {
    burst(car.x, car.y, '#ff7b2f', 40, 320);
    burst(car.x, car.y, '#3c3f46', 25, 200);
    audio.crash();
    state.camera.shake = 10;
    if (car === player.car) {
      player.onFoot = true;
      player.car = null;
      player.x = car.x + 40; player.y = car.y;
      state.health -= 25;
    }
    const i = state.cars.indexOf(car);
    if (i >= 0) state.cars.splice(i, 1);
    if (state.cars.length < 34) state.cars.push(spawnTrafficCar());
  }

  // --- Traffic, pedestrians, police ----------------------------------------

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      car.turnCooldown -= dt;
      // Slow down if another car is right ahead.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car) continue;
        const dx = other.x - car.x, dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 30) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.maxSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      let nx = car.x + Math.cos(car.angle) * car.speed * dt;
      let ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const onV = Math.abs(nx - nearestAvenue(nx)) < 12;
      const onH = Math.abs(ny - nearestStreet(ny)) < 12;
      if (onV && onH && car.turnCooldown <= 0 && rng.chance(0.3)) {
        car.turnCooldown = rng.range(2, 5);
        if (car.vertical) {
          car.vertical = false;
          car.angle = rng.chance(0.5) ? 0 : Math.PI;
          ny = nearestStreet(ny) + (rng.chance(0.5) ? -22 : 22);
        } else {
          car.vertical = true;
          car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          nx = nearestAvenue(nx) + (rng.chance(0.5) ? -22 : 22);
        }
      }
      car.x = clamp(nx, 40, WORLD.w - 40);
      car.y = clamp(ny, 40, WORLD.h - 40);
      if (car.y >= city.bayTop - 30) { car.y = city.bayTop - 30; car.angle = -car.angle; }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          const i = state.peds.indexOf(ped);
          if (i >= 0) state.peds.splice(i, 1);
          state.peds.push(spawnPed(rng.range(200, WORLD.w - 200), rng.range(200, WORLD.h - 300)));
        }
        continue;
      }
      ped.stateTimer -= dt;
      if (ped.kind === 'cop' && state.wanted > 0) {
        // Foot cops run the player down.
        const d = Math.hypot(player.x - ped.x, player.y - ped.y);
        const a = Math.atan2(player.y - ped.y, player.x - ped.x);
        ped.angle = a;
        const sp = 150;
        const next = resolveCollision(city, ped.x + Math.cos(a) * sp * dt, ped.y + Math.sin(a) * sp * dt, 12);
        ped.x = next.x; ped.y = next.y;
        if (d < 30 && player.invuln <= 0) {
          state.bustedTimer += dt;
          if (state.bustedTimer > 1.1) { bustPlayer(); return; }
        } else {
          state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
        }
        continue;
      }
      if (ped.state === 'flee') {
        const a = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
        ped.angle = a;
        const next = resolveCollision(city, ped.x + Math.cos(a) * 150 * dt, ped.y + Math.sin(a) * 150 * dt, 12);
        ped.x = next.x; ped.y = next.y;
        if (ped.stateTimer <= 0) { ped.state = 'walk'; ped.stateTimer = rng.range(2, 6); }
        continue;
      }
      if (ped.stateTimer <= 0) {
        ped.stateTimer = rng.range(2, 6);
        ped.angle = rng.range(0, Math.PI * 2);
      }
      const next = resolveCollision(city, ped.x + Math.cos(ped.angle) * ped.speed * dt, ped.y + Math.sin(ped.angle) * ped.speed * dt, 12);
      ped.x = next.x; ped.y = next.y;
      // Flee from a speeding car or a gunshot.
      const pd = Math.hypot(player.x - ped.x, player.y - ped.y);
      if (!player.onFoot && pd < 130 && player.speed > 200) {
        ped.state = 'flee'; ped.stateTimer = 2; ped.fleeX = player.x; ped.fleeY = player.y;
      }
    }
  }

  function updatePolice(dt) {
    const wanted = state.wanted;
    let policeCars = state.cars.filter((c) => c.kind === 'police');
    const wantCars = wanted > 0 ? Math.min(wanted, 3) : 0;
    // Spawn police cars on the road, away from the player.
    while (policeCars.length < wantCars) {
      const c = spawnTrafficCar();
      c.kind = 'police';
      c.color = PALETTE.police;
      c.maxSpeed = TUNING.policeSpeed;
      c.siren = true;
      c.hp = 120;
      // Place it on a road 500-800px from the player.
      let tries = 0;
      do {
        const vertical = rng.chance(0.5);
        if (vertical) {
          c.x = rng.pick(AVENUES); c.y = rng.range(150, WORLD.h - 150);
        } else {
          c.x = rng.range(150, WORLD.w - 150); c.y = rng.pick(STREETS);
        }
        tries++;
      } while (Math.hypot(c.x - player.x, c.y - player.y) < 500 && tries < 20);
      state.cars.push(c);
      policeCars.push(c);
    }
    // Wanted 2+ also sends foot cops.
    const wantCops = wanted >= 2 ? wanted - 1 : 0;
    const cops = state.peds.filter((p) => p.kind === 'cop' && !p.down);
    while (cops.length < wantCops) {
      const cop = spawnPed(player.x + rng.range(-400, 400), player.y + rng.range(-400, 400));
      cop.kind = 'cop';
      cop.color = '#2b4fd9';
      state.peds.push(cop);
      cops.push(cop);
    }
    // Chase the player.
    for (const car of policeCars) {
      const d = Math.hypot(player.x - car.x, player.y - car.y);
      const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
      car.angle += clamp(angleDiff(car.angle, targetAngle), -2.4 * dt, 2.4 * dt);
      const speed = d > 260 ? car.maxSpeed : car.maxSpeed * 0.7;
      car.speed += (speed - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = resolveCollision(city, nx, ny, 22);
      car.x = hit.x; car.y = hit.y;
      if (hit.x !== nx || hit.y !== ny) car.speed *= 0.5;
      // Ram the player.
      if (d < 46) {
        if (player.onFoot) {
          if (player.invuln <= 0) {
            state.health -= TUNING.policeRamDamage;
            player.invuln = 0.8;
            burst(player.x, player.y, '#c94f3d', 8, 140);
            audio.crash();
            if (state.health <= 0) { wastePlayer(); return; }
          }
        } else if (player.car) {
          player.car.hp -= 0.4;
          state.camera.shake = 4;
          if (Math.abs(car.speed) > 200 && state.time - (state.lastRamSound || 0) > 0.5) {
            state.lastRamSound = state.time;
            audio.crash();
          }
          if (player.car.hp <= 0) explodeCar(player.car);
        }
        car.speed *= 0.6;
      }
    }
    // Heat fades when no police can see the player.
    if (wanted > 0) {
      const nearestPolice = Math.min(
        ...policeCars.map((c) => Math.hypot(c.x - player.x, c.y - player.y)),
        ...cops.map((p) => Math.hypot(p.x - player.x, p.y - player.y)),
        Infinity,
      );
      if (nearestPolice > 520) {
        state.wantedTimer += dt * 1000;
        if (state.wantedTimer > TUNING.wantedDecayMs) {
          state.wanted--;
          state.wantedTimer = 0;
          say(state.wanted === 0 ? 'You lost the heat.' : `Wanted level ${state.wanted}`, 3);
        }
      } else {
        state.wantedTimer = 0;
      }
    }
    // When the heat is gone, police cars leave.
    if (wanted === 0) {
      for (const car of policeCars) {
        car.kind = 'traffic';
        car.siren = false;
        car.maxSpeed = rng.range(110, 160);
      }
      for (const cop of cops) {
        const i = state.peds.indexOf(cop);
        if (i >= 0) state.peds.splice(i, 1);
      }
    }
  }

  function bustPlayer() {
    const fine = Math.min(state.cash, TUNING.bustedFine);
    state.cash -= fine;
    state.wanted = 0;
    state.health = TUNING.maxHealth;
    state.stats.busts++;
    state.bustedTimer = 0;
    player.x = city.places.policeHQ.x; player.y = city.places.policeHQ.y;
    if (player.car) { player.car.kind = 'parked'; player.car.speed = 0; player.car = null; }
    player.onFoot = true;
    state.mode = 'busted';
    audio.busted();
    save();
  }

  function wastePlayer() {
    const fine = Math.min(state.cash, TUNING.wastedFine);
    state.cash -= fine;
    state.wanted = 0;
    state.health = TUNING.maxHealth;
    state.stats.wasted++;
    player.x = city.places.hospital.x; player.y = city.places.hospital.y;
    if (player.car) { player.car.kind = 'parked'; player.car.speed = 0; player.car = null; }
    player.onFoot = true;
    state.mode = 'wasted';
    audio.wasted();
    save();
  }

  // --- Bullets, pickups, particles ----------------------------------------

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.down) continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
            damagePed(ped, TUNING.pistolDamage, player.x, player.y);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car === player.car) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
            car.hp -= TUNING.pistolDamage;
            burst(b.x, b.y, '#ffd76a', 5, 120);
            if (car.hp <= 0) explodeCar(car);
            dead = true;
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function updatePickups(dt) {
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      pk.bob += dt * 3;
      const d = Math.hypot(pk.x - player.x, pk.y - player.y);
      if (d < 34) {
        if (pk.kind === 'cash') { const amt = rng.int(20, 60); state.cash += amt; say(`+$${amt} cash picked up`, 2); }
        if (pk.kind === 'health') { state.health = Math.min(TUNING.maxHealth, state.health + 40); say('Health +40', 2); }
        if (pk.kind === 'ammo') { player.ammo += 24; say('Ammo +24', 2); }
        audio.pickup();
        burst(pk.x, pk.y, '#f2c200', 12, 160);
        state.pickups.splice(i, 1);
        state.pickups.push(spawnPickup(pk.kind));
      }
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  // --- Main update ----------------------------------------------------------

  function update(dt, input) {
    if (state.mode !== 'playing') return;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (!state.mission && state.missionIndex < MISSIONS.length) startMission(state.missionIndex);
    updatePlayer(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateBullets(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateMission(dt);
    // Camera follows the player, with a little shake on impacts.
    const targetX = clamp(player.x, 640, WORLD.w - 640);
    const targetY = clamp(player.y, 400, WORLD.h - 400);
    state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
    state.camera.shake = Math.max(0, state.camera.shake - dt * 20);
    audio.setSiren(state.wanted > 0, state.wanted);
    if (player.onFoot) audio.setEngine(0, false);
  }

  return { state, player, city, rng, say, addWanted, burst, nearestCar, startMission, completeMission, failMission, updateMission, save, load, spawnTrafficCar, spawnParkedCar, spawnPed, spawnPickup, update, bustPlayer, wastePlayer };
}
