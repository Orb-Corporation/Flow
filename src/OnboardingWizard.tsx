import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileJson,
  MousePointer2,
  Workflow,
} from 'lucide-react'

type OnboardingWizardProps = {
  onClose: () => void
}

const steps = [
  {
    title: 'Build a workflow visually',
    description: 'Flow turns a process into connected blocks. Start with a trigger, then add actions and logic.',
    detail: 'On desktop, drag blocks from the left panel. On a phone or tablet, open Blocks at the bottom and tap a block to add it.',
    icon: Workflow,
  },
  {
    title: 'Connect and configure',
    description: 'Connect the small handles between blocks to define the order in which they run.',
    detail: 'Select any block to edit its settings. On touch screens, the Settings panel opens automatically after you select or add a block.',
    icon: MousePointer2,
  },
  {
    title: 'Save and try a preview',
    description: 'Your current workflow is saved on this device. Export a JSON copy to move it to another device.',
    detail: 'Use Run workflow to inspect the local preview log. Import and Export are available in the top bar.',
    icon: FileJson,
  },
]

export default function OnboardingWizard({ onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const Icon = current.icon

  return (
    <div className="wizard-backdrop">
      <section aria-labelledby="wizard-title" aria-modal="true" className="wizard-card" role="dialog">
        <div className="wizard-brand">
          <span className="wizard-brand-mark"><Workflow size={17} /></span>
          <span>FLOW · BY ORB TECHNOLOGIES</span>
        </div>

        <div aria-label={`Step ${step + 1} of ${steps.length}`} className="wizard-progress">
          {steps.map((_, index) => (
            <span className={index <= step ? 'is-complete' : ''} key={index} />
          ))}
        </div>

        <div className="wizard-step-icon"><Icon size={23} /></div>
        <h1 id="wizard-title">{current.title}</h1>
        <p>{current.description}</p>
        <div className="wizard-detail">
          <CheckCircle2 size={16} />
          <span>{current.detail}</span>
        </div>
        <div className="wizard-warning">
          Orb! runtime integration is not connected in this preview yet. Run workflow currently simulates the blocks locally; it does not call real APIs or access files, email, or external services.
        </div>

        <div className="wizard-footer">
          <button className="wizard-skip" onClick={onClose} type="button">Skip tour</button>
          <span className="wizard-step-count">{step + 1} / {steps.length}</span>
          <span className="wizard-footer-spacer" />
          <button className="wizard-button" disabled={step === 0} onClick={() => setStep((value) => value - 1)} type="button">
            <ArrowLeft size={14} /> Back
          </button>
          <button className="wizard-button primary" onClick={() => step === steps.length - 1 ? onClose() : setStep((value) => value + 1)} type="button">
            {step === steps.length - 1 ? 'Open Flow' : 'Next'}
            {step === steps.length - 1 ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
          </button>
        </div>
      </section>
    </div>
  )
}
