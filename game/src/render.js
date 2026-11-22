// Everything Costa Verde draws: the city, the cars, the people, the effects, the
// HUD with its live minimap, and the title, pause, busted, wasted and win screens.
import { CITY, DISTRICTS, CAR, PLAYER, MISSIONS } from './config.js';
import { districtAt, isRoad } from './city.js';
import { clamp } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 800;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const minimap = document.createElement('canvas');
  minimap.width = 210;
  minimap.height = 164;
  const mm = minimap.getContext('2d');

  function drawCar(x, y, angle, color, opts) {
    opts = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Body.
    ctx.fillStyle = color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 6);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(-6, -CAR.width / 2 + 3, 16, CAR.width - 6, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(CAR.length / 2 - 6, -CAR.width / 2 + 4, 3, CAR.width - 8);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 2, 3, 4);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 6, 3, 4);
    if (opts.police) {
      // Light bar, flashing red/blue with the world clock.
      const phase = Math.floor(opts.time * 3) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.fillRect(-4, -CAR.width / 2 - 2, 8, 5);
      ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      ctx.fillRect(-4, CAR.width / 2 - 3, 8, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawWorld(world) {
    const cam = world.camera;
    const ox = cam.x - VIEW_W / 2;
    const oy = cam.y - VIEW_H / 2;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-ox, -oy);

    // Ground: district-tinted blocks.
    ctx.fillStyle = '#8f9a7a';
    ctx.fillRect(0, 0, CITY.width, CITY.height);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    // The bay.
    const wave = Math.sin(world.time * 1.4) * 3;
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(0, CITY.bayTop + wave, CITY.width, CITY.height - CITY.bayTop);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 100; x < CITY.width; x += 260) {
      ctx.fillRect(x + Math.sin(world.time + x) * 8, CITY.bayTop + 24 + ((x / 260) % 3) * 26, 90, 3);
    }
    // Roads.
    ctx.fillStyle = '#3d4148';
    for (const ax of CITY.avenues) ctx.fillRect(ax - CITY.roadWidth / 2, 0, CITY.roadWidth, CITY.bayTop);
    for (const sy of CITY.streets) ctx.fillRect(0, sy - CITY.roadWidth / 2, CITY.width, CITY.roadWidth);
    // Lane dashes.
    ctx.fillStyle = '#e8d44f';
    for (const ax of CITY.avenues) {
      for (let y = 40; y < CITY.bayTop; y += 90) ctx.fillRect(ax - 2, y, 4, 42);
    }
    for (const sy of CITY.streets) {
      for (let x = 40; x < CITY.width; x += 90) ctx.fillRect(x, sy - 2, 42, 4);
    }
    // Sidewalk edges.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (const ax of CITY.avenues) {
      ctx.beginPath(); ctx.moveTo(ax - CITY.roadWidth / 2, 0); ctx.lineTo(ax - CITY.roadWidth / 2, CITY.bayTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax + CITY.roadWidth / 2, 0); ctx.lineTo(ax + CITY.roadWidth / 2, CITY.bayTop); ctx.stroke();
    }
    // Parks: soft green circles for the trees.
    for (const t of world.city.trees) {
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57a04e';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    // Buildings with roof shading and a darker edge.
    for (const b of world.city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = b.accent;
      ctx.fillRect(b.x + 6, b.y + 6, Math.min(26, b.w - 12), 5);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.25, b.w * 0.5, b.h * 0.5);
      }
    }
    // Landmark labels, skipped where the mission marker already sits, so the
    // two texts never print on top of each other.
    const marker = world.missionTarget();
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(world.city.landmarks)) {
      const lm = world.city.landmarks[key];
      if (marker && world.state === 'playing' && Math.abs(lm.x - marker.x) < 60 && Math.abs(lm.y - marker.y) < 60) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(lm.label, lm.x + 1, lm.y + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(lm.label, lm.x, lm.y);
    }
    // Pickups, bobbing.
    for (const pk of world.pickups) {
      const bobY = Math.sin(pk.bob) * 3;
      const color = pk.kind === 'cash' ? '#37c978' : pk.kind === 'health' ? '#ff5d5d' : '#f2c230';
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bobY, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bobY + 5);
    }
    // Mission target marker: a gold star with a bouncing arrow.
    const target = world.missionTarget();
    if (target && world.state === 'playing') {
      const bounce = Math.sin(world.time * 4) * 6;
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.arc(target.x, target.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', target.x, target.y + 7);
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 34 + bounce);
      ctx.lineTo(target.x - 9, target.y - 50 + bounce);
      ctx.lineTo(target.x + 9, target.y - 50 + bounce);
      ctx.closePath();
      ctx.fill();
      // White text with a black outline, readable on dark roads.
      ctx.font = 'bold 14px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(target.label, target.x, target.y + 34);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(target.label, target.x, target.y + 34);
    }
    // Pedestrians.
    for (const ped of world.peds) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.cop ? '#2e5fd8' : ped.color;
      ctx.beginPath(); ctx.arc(0, 0, ped.cop ? 12 : 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1c1c1c';
      ctx.beginPath(); ctx.arc(6, -4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (ped.cop) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('POLICE', ped.x, ped.y - 16);
      }
    }
    // Cars.
    for (const car of world.cars) {
      drawCar(car.x, car.y, car.angle, car.color, { police: car.kind === 'police', time: world.time });
      if (car.kind === 'hero' || car.kind === 'police') {
        const maxHp = car.kind === 'police' ? 500 : 600;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(car.x - 22, car.y - 32, 44, 5);
        ctx.fillStyle = car.hp > maxHp * 0.4 ? '#37c978' : '#ff5d5d';
        ctx.fillRect(car.x - 22, car.y - 32, 44 * clamp(car.hp / maxHp, 0, 1), 5);
      }
    }
    // The player on foot.
    const p = world.player;
    if (!p.inCar && (world.state === 'playing' || world.state === 'paused')) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath(); ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(4, -7, 12, 14);
      ctx.fillStyle = '#1c1c1c';
      ctx.beginPath(); ctx.arc(8, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Aim line while shooting.
      if (p.shootTimer > 0.1) {
        ctx.strokeStyle = 'rgba(255,215,106,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.aimAngle) * 60, p.y + Math.sin(p.aimAngle) * 60);
        ctx.stroke();
      }
      // Robbery progress ring.
      if (p.robTimer > 0) {
        ctx.strokeStyle = '#f2c230';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + (p.robTimer / 2) * Math.PI * 2);
        ctx.stroke();
      }
    }
    // Particles.
    for (const pt of world.particles) {
      ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMinimap(world) {
    const sx = minimap.width / CITY.width;
    const sy = minimap.height / CITY.height;
    mm.fillStyle = '#14181d';
    mm.fillRect(0, 0, minimap.width, minimap.height);
    mm.fillStyle = '#2e4a5a';
    mm.fillRect(0, CITY.bayTop * sy, minimap.width, minimap.height - CITY.bayTop * sy);
    mm.fillStyle = '#3d4148';
    for (const ax of CITY.avenues) mm.fillRect(ax * sx - 2, 0, 4, CITY.bayTop * sy);
    for (const sy2 of CITY.streets) mm.fillRect(0, sy2 * sy - 2, minimap.width, 4);
    const target = world.missionTarget();
    if (target && world.state === 'playing') {
      mm.fillStyle = '#f2c230';
      mm.beginPath(); mm.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2); mm.fill();
    }
    mm.fillStyle = '#2e6bff';
    for (const car of world.cars) if (car.kind === 'police') {
      mm.beginPath(); mm.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2); mm.fill();
    }
    mm.fillStyle = '#ffffff';
    for (const car of world.cars) if (car.kind === 'traffic') mm.fillRect(car.x * sx - 1, car.y * sy - 1, 2, 2);
    // Player arrow.
    const p = world.player;
    mm.save();
    mm.translate(p.x * sx, p.y * sy);
    mm.rotate(p.angle);
    mm.fillStyle = '#ff5d5d';
    mm.beginPath();
    mm.moveTo(7, 0); mm.lineTo(-5, -5); mm.lineTo(-5, 5);
    mm.closePath(); mm.fill();
    mm.restore();
    ctx.drawImage(minimap, 16, VIEW_H - 180);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, VIEW_H - 180, minimap.width, minimap.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(world.districtName(), 16, VIEW_H - 188);
  }

  function drawHud(world) {
    const p = world.player;
    ctx.textAlign = 'left';
    // Top-left: cash and health.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(12, 12, 250, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#37c978';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`$${p.cash}`, 24, 42);
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 52, 150, 10);
    ctx.fillStyle = p.hp > 40 ? '#37c978' : '#ff5d5d';
    ctx.fillRect(24, 52, 150 * clamp(p.hp / 100, 0, 1), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`HP ${Math.ceil(p.hp)}`, 182, 61);
    ctx.fillText(`AMMO ${p.ammo}`, 196, 42);
    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(VIEW_W - 212, 12, 200, 44, 10);
    ctx.fill();
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < world.wanted ? '#ffd21f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', VIEW_W - 182 + i * 36, 44);
    }
    // Bottom-centre: mission objective and timer.
    const m = world.mission;
    if (m && world.state === 'playing') {
      const label = world.missionPhase === 2 && m.id === 5
        ? 'Escape to the getaway car!'
        : `${m.id}. ${m.name} — ${m.target.label}`;
      ctx.font = 'bold 17px sans-serif';
      const w = ctx.measureText(label).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect((VIEW_W - w) / 2, VIEW_H - 62, w, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#f2c230';
      ctx.textAlign = 'center';
      ctx.fillText(label, VIEW_W / 2, VIEW_H - 36);
      if (m.timer && world.missionTimer > 0) {
        ctx.fillStyle = world.missionTimer < 15 ? '#ff5d5d' : '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${Math.ceil(world.missionTimer)}s`, VIEW_W / 2, VIEW_H - 76);
      }
    }
    // Speedometer, bottom-right.
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.9);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(VIEW_W - 132, VIEW_H - 84, 120, 52, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${kmh}`, VIEW_W - 72, VIEW_H - 44);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('km/h', VIEW_W - 72, VIEW_H - 28);
    }
    drawMinimap(world);
    // Toasts: top centre, below the HUD, never over the minimap.
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    world.toasts.forEach((t, i) => {
      const y = 96 + i * 30;
      const w = ctx.measureText(t.text).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect((VIEW_W - w) / 2, y - 20, w, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.text, VIEW_W / 2, y - 2);
    });
    // Controls hint, first seconds of play.
    if (world.frame < 60 * 9 && world.state === 'playing') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('WASD move / drive · E enter car · SPACE punch · Click shoot · P pause · M mute', VIEW_W - 16, VIEW_H - 190);
    }
  }

  function drawScreen(title, lines, accent) {
    ctx.fillStyle = 'rgba(8,12,18,0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#f2c230';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, VIEW_W / 2, 250);
    ctx.fillStyle = '#ffffff';
    ctx.font = '19px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW_W / 2, 310 + i * 32);
    });
  }

  function drawTitle(world) {
    drawWorld(world);
    ctx.fillStyle = 'rgba(8,12,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('COSTA VERDE', VIEW_W / 2, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic 22px sans-serif';
    ctx.fillText('A sun-soaked city. One driver. Five jobs. No way back.', VIEW_W / 2, 268);
    ctx.font = '17px sans-serif';
    const lines = [
      'Marco Solis just got out. Mama Rosa has work for him — five jobs across the city,',
      'from a stolen coupe in Old Town to the vault of Costa Verde Trust.',
      '',
      'WASD move and drive · E steal and enter cars · SPACE punch · Click to shoot',
      'P pause · M mute · The cops remember everything. Lose them to cool down.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 330 + i * 28));
    ctx.fillStyle = '#f2c230';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(world.saveExists ? 'Press ENTER to continue — or N for a new game' : 'Press ENTER to start', VIEW_W / 2, 560);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '14px sans-serif';
    ctx.fillText('An original open-world crime game. No real city, no borrowed names.', VIEW_W / 2, 620);
  }

  return {
    render(world) {
      // Fit the 1280x800 playfield into any window, letterboxed and centred,
      // so the game looks right at every size and the mouse math stays exact.
      const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0a0e13';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, (canvas.width - VIEW_W * scale) / 2, (canvas.height - VIEW_H * scale) / 2);
      if (world.state === 'title') {
        drawTitle(world);
        return;
      }
      drawWorld(world);
      drawHud(world);
      if (world.state === 'paused') {
        drawScreen('PAUSED', ['Press P or ESC to keep playing', 'M toggles sound'], '#ffffff');
      } else if (world.state === 'busted') {
        drawScreen('BUSTED', [
          'The Costa Verde police finally caught up with Marco.',
          `You kept $${world.player.cash} and finished ${world.stats.missionsDone} of ${MISSIONS.length} missions.`,
          'Press ENTER to try again from the title screen.',
        ], '#5da8ff');
      } else if (world.state === 'wasted') {
        drawScreen('WASTED', [
          'Marco went down in the streets of Costa Verde.',
          `You kept $${world.player.cash} and finished ${world.stats.missionsDone} of ${MISSIONS.length} missions.`,
          'Press ENTER to try again from the title screen.',
        ], '#ff5d5d');
      } else if (world.state === 'win') {
        drawScreen('THE BIG SCORE', [
          'Marco walks out of Costa Verde Trust with the vault cash,',
          'the getaway car waiting, and Mama Rosa smiling for once.',
          `Final take: $${world.player.cash}. Costa Verde is yours, Marco.`,
          'Press ENTER to play again.',
        ], '#37c978');
      }
    },
  };
}
