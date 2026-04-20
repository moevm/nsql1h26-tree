import { NavLink } from "react-router-dom";
import "../style.css";

export default function Navbar() {
  return (
    <nav className="nav">
      <div className="nav-inner">

          <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
            Главная
          </NavLink>

          <NavLink to="/search" className={({ isActive }) => isActive ? "active" : ""}>
            Поиск
          </NavLink>

          <NavLink to="/graph" className={({ isActive }) => isActive ? "active" : ""}>
            Граф
          </NavLink>

          <NavLink to="/stats" className={({ isActive }) => isActive ? "active" : ""}>
            Статистика
          </NavLink>

          <NavLink to="/import" className={({ isActive }) => isActive ? "active" : ""}>
            Импорт
          </NavLink>

          <NavLink to="/export" className={({ isActive }) => isActive ? "active" : ""}>
            Экспорт
          </NavLink>

          <NavLink to="/add" className={({ isActive }) => isActive ? "active" : ""}>
            Добавление персоны
          </NavLink>

      </div>
    </nav>
  );
}