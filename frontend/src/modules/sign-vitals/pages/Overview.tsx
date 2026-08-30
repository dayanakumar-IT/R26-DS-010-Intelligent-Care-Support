import { useNavigate } from 'react-router-dom'
import { Brain, Hand } from 'lucide-react'
import Button from '../../../shared/components/Button'
import parkinsonsHero from '../assets/images/parkinsons-hero.jpg'
import glossHero from '../assets/images/gloss-hero.jpg'

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  ctaLabel: string
  onStart: () => void
  accent: string
  heroSrc: string
  /** Tailwind animation utility class — a lightweight decorative-only
   * looping animation. No licensed Lottie asset was sourced (this
   * environment can't download/verify external asset licensing), so
   * this uses the task's explicitly-sanctioned CSS fallback instead of
   * spending long hunting for one. Purely navigational decoration —
   * not clinical symptom content, which stays deferred as agreed. */
  animationClassName: string
}

function FeatureCard({
  icon,
  title,
  description,
  ctaLabel,
  onStart,
  accent,
  animationClassName,
  heroSrc,
}: FeatureCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm)] transition hover:shadow-[var(--shadow-md)]">
      <img
        src={heroSrc}
        alt=""
        className="aspect-[16/9] w-full rounded-[var(--radius-md)] object-cover"
      />
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] text-white ${animationClassName}`}
        style={{ background: accent }}
      >
        {icon}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      <Button onClick={onStart} className="w-full sm:w-auto">
        {ctaLabel}
      </Button>
    </div>
  )
}

export default function Overview() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-slate-900">Sign & Vitals</h1>
        <p className="text-sm text-slate-500">
          Learn practical skills that support safer and more effective care.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <FeatureCard
          icon={<Brain size={22} />}
          title="Parkinson's Symptom Education"
          description="Learn to recognize key Parkinson's symptoms through educational explanations, scenarios, quizzes, and adaptive practice."
          ctaLabel="Start Learning"
          onStart={() => navigate('/sign-vitals/parkinsons')}
          accent="linear-gradient(135deg, #7c3aed, #a78bfa)"
          animationClassName="animate-pulse"
          heroSrc={parkinsonsHero}
        />
        <FeatureCard
          icon={<Hand size={22} />}
          title="GLOSS Sign Language Learning"
          description="Learn care-relevant signs through personalised recommendations, webcam practice, AI recognition, execution scoring, and corrective feedback."
          ctaLabel="Start Learning"
          onStart={() => navigate('/sign-vitals/sign-language')}
          accent="linear-gradient(135deg, #1e3a8a, #3b5fc4)"
          animationClassName="animate-bounce"
          heroSrc={glossHero}
        />
      </div>
    </div>
  )
}
