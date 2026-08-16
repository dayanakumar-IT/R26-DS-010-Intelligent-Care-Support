import { Link } from 'react-router-dom'
import { Button } from '../shared/components/Button'
import cls from './pages.module.css'

export function NotFound() {
  return (
    <div className={cls.center}>
      <div className={cls.pageTitle}>Page not found</div>
      <div className={cls.pageSubtitle}>
        The page you’re looking for doesn’t exist.
      </div>
      <Link to="/">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </div>
  )
}

