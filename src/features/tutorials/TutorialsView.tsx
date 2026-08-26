const tutorials = [
  { id: "pRSS8XaQAzo", title: "Agua con dato - Intro" },
  { id: "JvCw5dVUXJk", title: "Agua con dato - Vista Admin" },
  { id: "ljhFPL1RU_M", title: "Agua con Dato - Agregar medicion de Pozo" },
] as const;

export function TutorialsView() {
  return (
    <div className="view-stack tutorials-view">
      <div className="view-intro">
        <h2>Videos tutoriales</h2>
        <p>Aprende a utilizar las principales funciones de la plataforma.</p>
      </div>

      <div className="tutorials-grid">
        {tutorials.map((tutorial, index) => (
          <article className="tutorial-card" key={tutorial.id}>
            <div className="tutorial-card-header">
              <span>Tutorial {index + 1}</span>
              <h3>{tutorial.title}</h3>
            </div>
            <div className="tutorial-video-wrap">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="tutorial-video"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={`https://www.youtube-nocookie.com/embed/${tutorial.id}`}
                title={`${tutorial.title} ${index + 1}`}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
