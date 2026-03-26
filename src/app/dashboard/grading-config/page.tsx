'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'

interface GradingConfig {
  caWeight: number
  examWeight: number
  caBreakdown: {
    ca1: number
    ca2: number
    ca3: number
    ca4: number
    project: number
  }
}

export default function GradingConfigPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [config, setConfig] = useState<GradingConfig>({
    caWeight: 80,
    examWeight: 20,
    caBreakdown: {
      ca1: 20,
      ca2: 20,
      ca3: 20,
      ca4: 20,
      project: 20,
    }
  })

  const saveConfig = () => {
    localStorage.setItem('grading_config', JSON.stringify(config))
    toast.success('Grading configuration saved')
  }

  const totalCA = Object.values(config.caBreakdown).reduce((sum, v) => sum + v, 0)
  const totalWeight = config.caWeight + config.examWeight

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Grading Configuration</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure CA and Exam weighting</p>
      </div>

      <div className="card max-w-2xl">
        <div className="space-y-6">
          {/* Main Weighting */}
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Overall Weighting</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CA Weight (%)</label>
                <input
                  type="number"
                  value={config.caWeight}
                  onChange={(e) => setConfig({...config, caWeight: Number(e.target.value)})}
                  className="input"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="label">Exam Weight (%)</label>
                <input
                  type="number"
                  value={config.examWeight}
                  onChange={(e) => setConfig({...config, examWeight: Number(e.target.value)})}
                  className="input"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            {totalWeight !== 100 && (
              <p className="text-red-500 text-sm mt-2">Total must equal 100%</p>
            )}
          </div>

          {/* CA Breakdown */}
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">CA Breakdown (within CA)</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">CA 1 (%)</label>
                <input
                  type="number"
                  value={config.caBreakdown.ca1}
                  onChange={(e) => setConfig({
                    ...config,
                    caBreakdown: {...config.caBreakdown, ca1: Number(e.target.value)}
                  })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">CA 2 (%)</label>
                <input
                  type="number"
                  value={config.caBreakdown.ca2}
                  onChange={(e) => setConfig({
                    ...config,
                    caBreakdown: {...config.caBreakdown, ca2: Number(e.target.value)}
                  })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">CA 3 (%)</label>
                <input
                  type="number"
                  value={config.caBreakdown.ca3}
                  onChange={(e) => setConfig({
                    ...config,
                    caBreakdown: {...config.caBreakdown, ca3: Number(e.target.value)}
                  })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">CA 4 (%)</label>
                <input
                  type="number"
                  value={config.caBreakdown.ca4}
                  onChange={(e) => setConfig({
                    ...config,
                    caBreakdown: {...config.caBreakdown, ca4: Number(e.target.value)}
                  })}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">Project (%)</label>
                <input
                  type="number"
                  value={config.caBreakdown.project}
                  onChange={(e) => setConfig({
                    ...config,
                    caBreakdown: {...config.caBreakdown, project: Number(e.target.value)}
                  })}
                  className="input"
                  min="0"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              CA Breakdown Total: {totalCA}% {totalCA !== 100 && <span className="text-red-500">(must equal 100%)</span>}
            </p>
          </div>

          {/* Preview */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Calculation Preview</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Final Score = (CA Average × {config.caWeight}%) + (Exam × {config.examWeight}%)
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              CA Average = (CA1×{config.caBreakdown.ca1}% + CA2×{config.caBreakdown.ca2}% + CA3×{config.caBreakdown.ca3}% + CA4×{config.caBreakdown.ca4}% + Project×{config.caBreakdown.project}%) / 100
            </p>
          </div>

          {/* Save Button */}
          <button onClick={saveConfig} disabled={totalWeight !== 100 || totalCA !== 100} className="btn btn-primary w-full">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  )
}
