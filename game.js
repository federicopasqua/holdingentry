const canvas = document.getElementById("dg");
const ctx = canvas.getContext("2d");
let isPhone = window.innerHeight > window.innerWidth;
let R = canvas.width * 0.45;

const holding_tollerance = 5;

let heading, inbound, standard, correct;

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


function hideAnswerButtons(hidden) {
    const elements = document.getElementsByClassName("answer-button");
    for (let i = 0; i < elements.length; i++) {
        elements[i].style.display = hidden ? "none" : "";
    }
}

function nextQuestion() {
    document.getElementById("next-button").style.display = "none";
    hideAnswerButtons(false);
    heading = Math.floor(Math.random()*360);
    inbound = Math.floor(Math.random()*360);
    standard = Math.random() < 0.5;
    correct = holdingEntry(heading, inbound, standard);

    document.getElementById("info").innerText =
        `HDG ${String(heading).padStart(3, "0")}°  INB ${String(inbound).padStart(3, "0")}° ${standard ? "Right" : "Left"} Turns`;

    document.getElementById("result").innerText = "";
    drawDG();
}

function displayingSolution() {
    return document.getElementById("result").innerText != "";
}

function answer(a) {
    document.getElementById("next-button").style.display = "";
    hideAnswerButtons(true);
    drawEntrySectors();
    drawHoldingPattern();
    document.getElementById("result").innerText =
        (correct.includes(a))
        ? `✅ Correct - ${correct.join(" or ")}`
        : `❌ Wrong — ${correct.join (" or ")}`;
}

document.addEventListener("keydown", e => {
    if (!displayingSolution()) {
        if (e.key === "d" || e.key === "1") answer("Direct");
        if (e.key === "p" || e.key === "2") answer("Parallel");
        if (e.key === "t" || e.key === "3") answer("Teardrop");
    }
    if (e.key === "Enter") nextQuestion();
});

function resizeCanvas() {
    isPhone = window.innerHeight > window.innerWidth && window.innerWidth < 600;
    const ratio = Math.ceil(window.devicePixelRatio || 1);

    const size = isPhone ? 
                    Math.min(window.innerWidth, window.innerHeight * 0.80) : 
                    Math.min(window.innerWidth, window.innerHeight * 0.75);
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
    if (displayingSolution()) {
        drawEntrySectors();
        drawHoldingPattern();
    }
});

resizeCanvas();
nextQuestion();
