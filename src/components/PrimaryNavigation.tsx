import { NavLink } from 'react-router-dom'

const navigationItems = [
  { to: '/', label: '今日', end: true },
  { to: '/tasks', label: '任务库', end: false },
  { to: '/data-info', label: '数据与说明', end: false },
] as const

export function PrimaryNavigation() {
  return (
    <nav aria-label="主导航">
      <ul className="primary-navigation">
        {navigationItems.map((item) => (
          <li key={item.to}>
            <NavLink
              className={({ isActive }) =>
                `primary-navigation__link${isActive ? ' primary-navigation__link--active' : ''}`
              }
              end={item.end}
              to={item.to}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
