export function SectionCard({ title, description, children }) {
  return (
    <section className="section-card">
      <div className="section-card__header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
