const canvas = document.getElementById("dg");
const ctx = canvas.getContext("2d");
let isPhone = window.innerHeight > window.innerWidth;
let R = canvas.width * 0.45;

const holding_tollerance = 5;

let heading, inbound, standard, correct;

// ---- app state ----
let mode = "holding";        // "holding" | "intercept"
let showRadial = true;       // intercept mode: draw the VOR course / deviation on the rose
let ic = null;               // current intercept question

const DOT_DEG = 5;           // degrees per dot (VOR: 2 dots each side = 10 deg full scale)
const $ = id => document.getElementById(id);

function norm360(x) { return ((x % 360) + 360) % 360; }
function fmt(h) { h = norm360(Math.round(h)); return String(h === 0 ? 360 : h).padStart(3, "0"); }
function sgn(x) { return x < 0 ? -1 : 1; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function holdingEntry(heading, inbound, standard) {
    const d = (inbound - heading + 360) % 360

    const allowed = [];

    if (standard) {
        if (0 <= d && d <= 70 + holding_tollerance) allowed.push("Direct")
        if (70 - holding_tollerance <= d && d <= 180 + holding_tollerance) allowed.push("Parallel")
        if (180 - holding_tollerance <= d && d <= 250 + holding_tollerance) allowed.push("Teardrop")
        if (250 - holding_tollerance <= d && d <= 360) allowed.push("Direct")
    } else {
        if (0 <= d && d <= 110 + holding_tollerance) allowed.push("Direct")
        if (110 - holding_tollerance <= d && d <= 180 + holding_tollerance) allowed.push("Teardrop")
        if (180 - holding_tollerance <= d && d <= 290 + holding_tollerance) allowed.push("Parallel")
        if (290 - holding_tollerance <= d && d <= 360) allowed.push("Direct")
    }

    return allowed;
}

function drawHoldCourse() {
    // Inbound course line
    ctx.strokeStyle = "cyan";
    const ca = (inbound-heading)*Math.PI/180;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.sin(ca)*R, -Math.cos(ca)*R);
    ctx.lineTo(-Math.sin(ca)*R, Math.cos(ca)*R);
    ctx.stroke();

    // Airbus-style perpendicular bar
    const bx = Math.sin(ca)*R*0.4;
    const by = -Math.cos(ca)*R*0.4;
    const pa = ca + Math.PI/2;

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(
        bx + Math.sin(pa)*25,
        by - Math.cos(pa)*25
    );
    ctx.lineTo(
        bx - Math.sin(pa)*25,
        by + Math.cos(pa)*25
    );
    ctx.stroke();

}

function drawDG() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Circle
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0,0,R,0,2*Math.PI);
    ctx.stroke();

    // Ticks + numbers
    ctx.fillStyle = "white";
    ctx.font = `${isPhone ? "18" : "30"}px Arial`;

    for (let d=0; d<360; d+=5) {
        const a = (d-heading)*Math.PI/180;
        const xo = Math.sin(a);
        const yo = -Math.cos(a);

        const len = (d%10===0)?18:8;
        ctx.lineWidth = (d%30===0)?3:(d%10===0)?2.5:2;

        ctx.beginPath();
        ctx.moveTo(xo*R*1, yo*R*1);
        ctx.lineTo(xo*(R*1+len), yo*(R*1+len));
        ctx.stroke();

        if (d%30===0) {
            ctx.save();

            const r = isPhone ? R * 1.18 : R * 1.15;
            const txt = String(d / 10);

            ctx.translate(xo * r, yo * r);

            // Rotate so text base faces center
            ctx.rotate(a);

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(txt, 0, 0);

            ctx.restore();
        }
    }

    if (mode === "holding") drawHoldCourse();
    else if (showRadial) drawVorCourse();

    // Airbus-style aircraft symbol (yellow)
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 4;

    // Fuselage
    ctx.beginPath();
    ctx.moveTo(0, R * -0.12);
    ctx.lineTo(0, R * 0.12);
    ctx.stroke();

    // Wings
    ctx.beginPath();
    ctx.moveTo(R * -0.12, R * -0.07);
    ctx.lineTo(R * 0.12, R * -0.07);
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(R * -0.04, R * 0.07);
    ctx.lineTo(R * 0.04, R * 0.07);
    ctx.stroke();

    // Lubber line
    ctx.lineWidth = 4;
    ctx.strokeStyle = "yellow";
    ctx.beginPath();
    ctx.moveTo(0,-R*1.1);
    ctx.lineTo(0,-R*0.9);
    ctx.stroke();

    ctx.restore();
}

function drawEntrySectors() {
    ctx.save();

    const r = R * 0.9;

    const sectors = [
        { name: "Direct",   start: standard ? -110 : -70,  end: standard ? 70 : 110,  color: "rgba(0,255,0,0.2)",  label: "D" },
        { name: "Teardrop", start:  standard ? 180 : 110,  end: standard ? 250 : 180,  color: "rgba(255, 0, 0, 0.2)", label: "T" },
        { name: "Parallel", start: standard ? 70 : 180,  end: standard ? 180 : 290,  color: "rgba(0,0,255,0.2)",   label: "P" }
    ];

    sectors.forEach(s => {
        ctx.beginPath();
        ctx.moveTo(0,0);

        ctx.fillStyle = s.color; // semi-transparent

        ctx.arc(
            0,
            0,
            r,
            (s.start - 90) * Math.PI / 180,
            (s.end - 90) * Math.PI / 180
        );

        ctx.closePath();
        ctx.fill();

        // Label
        const mid = (s.start + s.end) / 2;
        const a = (mid - 180) * Math.PI / 180;

        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            s.label,
            -Math.sin(a) * r * 0.55,
            Math.cos(a) * r * 0.55
        );
    });

    ctx.restore();
}

function drawHoldingPattern() {
    ctx.save();

    const r = R * 0.5;      // half-length of inbound/outbound legs
    const turnRadius = 40;   // radius of the 180° turns
    const inboundRad = (inbound - heading) * Math.PI / 180;

    const dir = standard ? 1 : -1;

    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;

    // Compute points
    const startX = 0;
    const startY = 0;
    const endX = -Math.sin(inboundRad) * r;
    const endY = Math.cos(inboundRad) * r;

     // Compute arc centers perpendicular to the leg
    const perpXStart = startX + Math.cos(inboundRad) * turnRadius * dir;
    const perpYStart = startY + Math.sin(inboundRad) * turnRadius * dir;

    const perpXEnd = endX + Math.cos(inboundRad) * turnRadius * dir;
    const perpYEnd = endY + Math.sin(inboundRad) * turnRadius * dir;

    // Inbound leg
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Outbound leg
    ctx.beginPath();
    ctx.moveTo(perpXStart * 2, perpYStart * 2);
    ctx.lineTo(endX + Math.cos(inboundRad) * turnRadius * dir * 2, endY + Math.sin(inboundRad) * turnRadius * dir * 2);
    ctx.stroke();

    // Outbound turn arc
    ctx.beginPath();
    ctx.arc(
        perpXEnd,
        perpYEnd,
        turnRadius,
        inboundRad + Math.PI,
        inboundRad + Math.PI + dir * Math.PI,
        true
    );
    ctx.stroke();

    // Inbound turn arc
    ctx.beginPath();
    ctx.arc(
        perpXStart,
        perpYStart,
        turnRadius,
        inboundRad + dir * Math.PI,
        inboundRad,
        false
    );
    ctx.stroke();

    // Arrows at ends
    const arrowX = (perpXStart * 2 + endX + Math.cos(inboundRad) * turnRadius * dir * 2) / 2;
    const arrowY = (perpYStart * 2 + endY + Math.sin(inboundRad) * turnRadius * dir * 2) / 2;

    const outAngle = inboundRad + Math.PI / 2 ;
    drawArrow(
        arrowX,
        arrowY,
        outAngle,
        15
    );

    // Chevron on inbound turn
    const inAngle = inboundRad - Math.PI / 2;
    drawArrow(
        (startX + endX) / 2,
        (startY + endY) / 2,
        inAngle,
        15
    );

    ctx.restore();
}


function drawArrow(x, y, angle, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.6);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size * 0.6);
    ctx.stroke();

    ctx.restore();
}



// ======================================================================
//  RADIAL INTERCEPT
// ======================================================================

function newIntercept() {
    heading = Math.floor(Math.random() * 360);
    const radial = Math.floor(Math.random() * 360) + 1;
    const outbound = Math.random() < 0.5;
    const A = Math.random() < 0.5 ? 30 : 45;                   // intercept angle
    const d = (3 + Math.floor(Math.random() * 23)) * (Math.random() < 0.5 ? -1 : 1);  // aircraft radial - selected radial
    const acRadial = norm360(radial + d);

    const C = outbound ? norm360(radial) : norm360(radial + 180); // course to fly along the radial
    // + : aircraft is to the RIGHT of the track (looking along C)
    // outbound: aircraft clockwise of radial -> right of track; inbound: opposite
    const rightOfTrack = outbound ? d : -d;
    const lineOnLeft = rightOfTrack > 0;
    const s = lineOnLeft ? -1 : 1;                              // intercept heading = C + s*A
    const correctH = norm360(C + s * A);

    const opts = [
        { h: correctH,                   ok: true,  why: "" },
        { h: norm360(C - s * A),         ok: false, why: "that is the wrong side - it takes you away from the radial" },
        { h: norm360(C + 180 - s * A),   ok: false, why: "that is the reciprocal track (you mixed up inbound/outbound)" },
        { h: norm360(C + 180 + s * A),   ok: false, why: "that is the reciprocal track, on the wrong side as well" }
    ];
    shuffle(opts);

    ic = { radial, outbound, A, d, acRadial, C, rightOfTrack, lineOnLeft, s, correctH, opts };
}

// deviation: signed number of dots the line is displaced to the RIGHT of the aircraft (clamped to +-2)
function icDevDots() {
    const dots = Math.min(2, Math.abs(ic.rightOfTrack) / DOT_DEG);
    // aircraft right of track -> line is on the left -> negative
    return -sgn(ic.rightOfTrack) * dots;
}

function dotPx() { return R * 0.16; }

// VOR/HSI style display: course pointer through the centre, deviation bar displaced
// geometrically (correct sensing whatever the heading is relative to the selected course)
function drawVorCourse() {
    const ca = (ic.C - heading) * Math.PI / 180;
    const ux = Math.sin(ca), uy = -Math.cos(ca);   // along course
    const px = Math.cos(ca), py = Math.sin(ca);    // to the right of course
    const off = icDevDots() * dotPx();

    ctx.save();
    ctx.strokeStyle = "cyan";
    ctx.fillStyle = "cyan";
    ctx.lineCap = "butt";

    // deviation scale (dots)
    ctx.fillStyle = "white";
    [-2, -1, 1, 2].forEach(k => {
        ctx.beginPath();
        ctx.arc(px * k * dotPx(), py * k * dotPx(), 5, 0, 2 * Math.PI);
        ctx.fill();
    });
    ctx.fillStyle = "cyan";

    // fixed parts of the course pointer
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ux * R * 0.5, uy * R * 0.5);
    ctx.lineTo(ux * R * 0.9, uy * R * 0.9);
    ctx.moveTo(-ux * R * 0.5, -uy * R * 0.5);
    ctx.lineTo(-ux * R * 0.9, -uy * R * 0.9);
    ctx.stroke();
    drawArrow(ux * R * 0.9, uy * R * 0.9, ca - Math.PI / 2, 18);

    // deviation bar (middle of the pointer)
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-ux * R * 0.5 + px * off, -uy * R * 0.5 + py * off);
    ctx.lineTo(ux * R * 0.5 + px * off, uy * R * 0.5 + py * off);
    ctx.stroke();

    // TO / FROM triangle on the bar (points toward the head for TO, toward the tail for FROM)
    const dir = ic.outbound ? -1 : 1;           // inbound = TO (head side), outbound = FROM (tail side)
    const tx = ux * dir * R * 0.3 + px * off, ty = uy * dir * R * 0.3 + py * off;
    const fx = ux * dir, fy = uy * dir;         // pointing direction
    const s = R * 0.07;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(tx + fx * s, ty + fy * s);
    ctx.lineTo(tx - fx * s + px * s * 0.9, ty - fy * s + py * s * 0.9);
    ctx.lineTo(tx - fx * s - px * s * 0.9, ty - fy * s - py * s * 0.9);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawInterceptSolution() {
    const ca = (ic.C - heading) * Math.PI / 180;
    const ux = Math.sin(ca), uy = -Math.cos(ca);
    const px = Math.cos(ca), py = Math.sin(ca);
    const off = icDevDots() * dotPx();
    // for the drawing keep the leg visible even for a tiny deviation
    const offDraw = Math.abs(off) < R * 0.1 ? sgn(off) * R * 0.1 : off;

    ctx.save();

    // the radial itself (when the display is off we reveal it here, dashed)
    if (!showRadial) {
        ctx.strokeStyle = "cyan";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(-ux * R * 0.9 + px * offDraw, -uy * R * 0.9 + py * offDraw);
        ctx.lineTo(ux * R * 0.9 + px * offDraw, uy * R * 0.9 + py * offDraw);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // intercept leg from the aircraft to the radial, then along it
    const ia = (ic.correctH - heading) * Math.PI / 180;
    const wx = Math.sin(ia), wy = -Math.cos(ia);
    const sinA = Math.sin(ic.A * Math.PI / 180);
    const t = Math.abs(offDraw) / sinA;
    const hx = wx * t, hy = wy * t;

    ctx.strokeStyle = "#3f3";
    ctx.fillStyle = "#3f3";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(hx, hy);
    ctx.lineTo(hx + ux * R * 0.35, hy + uy * R * 0.35);
    ctx.stroke();
    drawArrow(hx + ux * R * 0.35, hy + uy * R * 0.35, ca - Math.PI / 2, 16);

    // intercept heading label, just beyond the intercept point on the aircraft side
    ctx.font = `bold ${isPhone ? 16 : 22}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fmt(ic.correctH) + "°", wx * t * 0.5 + 24, wy * t * 0.5);

    ctx.restore();
}

function turnText(from, to) {
    const diff = norm360(to - from);
    if (diff === 0) return "already on that heading";
    return diff <= 180 ? `turn RIGHT ${diff}°` : `turn LEFT ${360 - diff}°`;
}

function answerIntercept(idx) {
    const o = ic.opts[idx];
    setSolutionState(true);
    drawInterceptSolution();

    const side = ic.lineOnLeft ? "LEFT" : "RIGHT";
    const explain =
        `Track ${ic.outbound ? "outbound" : "inbound"} R-${fmt(ic.radial)} → course ${fmt(ic.C)}° (${ic.outbound ? "FROM" : "TO"}). ` +
        `Radial is on your ${side} → intercept heading ${fmt(ic.C)}° ${ic.s > 0 ? "+" : "−"} ${ic.A}° = ${fmt(ic.correctH)}° ` +
        `(${turnText(heading, ic.correctH)}).`;

    const el = $("result");
    el.innerText = (o.ok ? "✅ Correct\n" : `❌ Wrong — ${fmt(o.h)}°: ${o.why}\n`) + explain;
}

// ======================================================================
//  MODE / UI
// ======================================================================

function setSolutionState(solution) {
    $("next-button").style.display = solution ? "" : "none";
    applyButtonVisibility(solution);
}

function applyButtonVisibility(solution) {
    const hold = mode === "holding";
    document.querySelectorAll(".hold-only").forEach(e => e.style.display = (!solution && hold) ? "" : "none");
    document.querySelectorAll(".ic-only").forEach(e => e.style.display = (!solution && !hold) ? "" : "none");
}

function nextQuestion() {
    setSolutionState(false);
    $("result").innerText = "";

    if (mode === "holding") {
        heading = Math.floor(Math.random()*360);
        inbound = Math.floor(Math.random()*360);
        standard = Math.random() < 0.5;
        correct = holdingEntry(heading, inbound, standard);

        $("info").innerText =
            `HDG ${String(heading).padStart(3, "0")}°  INB ${String(inbound).padStart(3, "0")}° ${standard ? "Right" : "Left"} Turns`;
    } else {
        newIntercept();
        $("info").innerText =
            `HDG ${fmt(heading)}°  ·  Track ${ic.outbound ? "OUTBOUND" : "INBOUND"} R-${fmt(ic.radial)}°\n` +
            `${ic.A}° intercept` + (showRadial ? "" : `  ·  You are on R-${fmt(ic.acRadial)}°`);
        document.querySelectorAll(".ic-only").forEach((b, i) => { b.innerText = `${fmt(ic.opts[i].h)}°  (${i + 1})`; });
    }
    drawDG();
}

function displayingSolution() {
    return $("result").innerText != "";
}

function redrawSolution() {
    if (!displayingSolution()) return;
    if (mode === "holding") { drawEntrySectors(); drawHoldingPattern(); }
    else drawInterceptSolution();
}

function answer(a) {
    setSolutionState(true);
    drawEntrySectors();
    drawHoldingPattern();
    $("result").innerText =
        (correct.includes(a))
        ? `✅ Correct - ${correct.join(" or ")}`
        : `❌ Wrong — ${correct.join (" or ")}`;
}

function setMode(m, keepQuestion) {
    mode = m;
    document.body.classList.toggle("mode-intercept", m === "intercept");
    $("mode").value = m;
    $("radial-toggle").style.display = m === "intercept" ? "" : "none";
    try { localStorage.setItem("trainer-mode", m); } catch (e) {}
    resizeCanvas();
    nextQuestion();
}

function setShowRadial(v) {
    showRadial = v;
    try { localStorage.setItem("trainer-show-radial", v ? "1" : "0"); } catch (e) {}
    if (mode === "intercept" && ic) {
        // refresh the prompt text (position is given in text when the display is off)
        const sol = displayingSolution();
        const txt = $("result").innerText;
        $("info").innerText =
            `HDG ${fmt(heading)}°  ·  Track ${ic.outbound ? "OUTBOUND" : "INBOUND"} R-${fmt(ic.radial)}°\n` +
            `${ic.A}° intercept` + (showRadial ? "" : `  ·  You are on R-${fmt(ic.acRadial)}°`);
        drawDG();
        if (sol) redrawSolution();
    }
}

document.addEventListener("keydown", e => {
    if (e.target && (e.target.tagName === "SELECT" || e.target.tagName === "INPUT")) {
        if (e.key !== "Enter") return;
    }
    if (!displayingSolution()) {
        if (mode === "holding") {
            if (e.key === "d" || e.key === "1") answer("Direct");
            if (e.key === "p" || e.key === "2") answer("Parallel");
            if (e.key === "t" || e.key === "3") answer("Teardrop");
        } else if (["1", "2", "3", "4"].includes(e.key)) {
            answerIntercept(Number(e.key) - 1);
        }
    }
    if (e.key === "Enter") { if (document.activeElement) document.activeElement.blur(); nextQuestion(); }
});

function resizeCanvas() {
    isPhone = window.innerHeight > window.innerWidth && window.innerWidth < 600;
    const ratio = Math.ceil(window.devicePixelRatio || 1);

    // lock the controls height to the height of the answer buttons so nothing jumps
    const controls = $("controls");
    controls.style.minHeight = "";
    const sol = displayingSolution();
    const nb = $("next-button").style.display;
    applyButtonVisibility(false);
    $("next-button").style.display = "none";
    controls.style.minHeight = controls.offsetHeight + "px";
    $("next-button").style.display = nb;
    applyButtonVisibility(sol);

    const wrap = $("canvas-wrap");
    const size = Math.max(100, Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight)));
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.translate(size / 2, size / 2);
    R = size * 0.35;
}

window.addEventListener("resize", () => {
    resizeCanvas();
    drawDG();
    redrawSolution();
});

$("mode").addEventListener("change", e => setMode(e.target.value));
$("show-radial").addEventListener("change", e => setShowRadial(e.target.checked));

(function init() {
    let m = "holding", sr = true;
    try {
        m = localStorage.getItem("trainer-mode") || m;
        sr = localStorage.getItem("trainer-show-radial") !== "0";
    } catch (e) {}
    showRadial = sr;
    $("show-radial").checked = sr;
    setMode(m === "intercept" ? "intercept" : "holding");
})();
