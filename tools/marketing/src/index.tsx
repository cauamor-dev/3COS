import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
} from "remotion";
const chapters = [
  {
    eyebrow: "AXIAL · DEMONSTRAÇÃO",
    title: "Horário marcado.\nSem conversa perdida.",
    body: "Um protótipo funcional de agendamento para pequenos negócios.",
  },
  {
    eyebrow: "UM FLUXO SIMPLES",
    title: "Escolha o serviço.\nReserve seu horário.",
    body: "Agenda com horários disponíveis e confirmação clara.",
  },
  {
    eyebrow: "DADOS FICTÍCIOS",
    title: "Uma ideia para testar\ncom um problema real.",
    body: "Material para revisão. Sem clientes, métricas ou resultados inventados.",
  },
];
function Demo() {
  const frame = useCurrentFrame();
  const chapter = chapters[Math.min(2, Math.floor(frame / 120))];
  const local = frame % 120;
  const opacity = interpolate(local, [0, 12, 108, 119], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "#07152d",
        fontFamily: "Arial, sans-serif",
        color: "#fff",
        padding: 70,
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at top right,#184478,transparent 65%)",
        }}
      />
      <div
        style={{
          position: "relative",
          opacity,
          display: "flex",
          height: "100%",
          flexDirection: "column",
        }}
      >
        <p style={{ fontSize: 24, letterSpacing: 5, color: "#ffbd58" }}>
          {chapter.eyebrow}
        </p>
        <h1
          style={{
            fontSize: 66,
            lineHeight: 1.12,
            whiteSpace: "pre-line",
            margin: "30px 0",
          }}
        >
          {chapter.title}
        </h1>
        <p style={{ fontSize: 31, lineHeight: 1.5, color: "#c3d2e8" }}>
          {chapter.body}
        </p>
        <div
          style={{
            marginTop: 38,
            border: "2px solid #315984",
            borderRadius: 28,
            overflow: "hidden",
            height: 870,
            background: "#f8fafc",
          }}
        >
          <Img
            src={staticFile("demo-flow.png")}
            style={{
              height: "100%",
              width: "100%",
              objectFit: "contain",
              objectPosition: "top",
            }}
          />
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 23,
            color: "#ffbd58",
          }}
        >
          <strong>AXIAL TECNOLOGIA</strong>
          <span>PROTÓTIPO · REVISÃO INTERNA</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}
registerRoot(() => (
  <Composition
    id="AxialDemo"
    component={Demo}
    durationInFrames={360}
    fps={30}
    width={1080}
    height={1920}
  />
));
