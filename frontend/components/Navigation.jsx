export function Navigation({ items, activeItem, onChange }) {
  return (
    <nav className="main-nav" aria-label="Hovednavigasjon">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-button ${activeItem === item.id ? 'is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
