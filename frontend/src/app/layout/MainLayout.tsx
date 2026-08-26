import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from './layout.module.css'

export default function MainLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
