'use client'
import Image from 'next/image'

export default function AppLoader() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      gap: 24,
      zIndex: 9999,
    }}>
      <div style={{
        position: 'relative',
        width: 80,
        height: 80,
      }}>
        <Image
          src="/schoolx-icon.svg"
          alt="SchoolX"
          width={80}
          height={80}
          style={{ 
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        <div style={{
          position: 'absolute',
          inset: -10,
          borderRadius: '50%',
          border: '2px solid var(--navy)',
          opacity: 0,
          animation: 'ripple 1.5s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          inset: -20,
          borderRadius: '50%',
          border: '2px solid var(--green)',
          opacity: 0,
          animation: 'ripple 1.5s ease-out infinite 0.5s',
        }} />
      </div>
      <div style={{
        fontFamily: 'Outfit',
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--navy)',
        letterSpacing: '-0.5px',
      }}>
        School<span style={{ color: 'var(--green)' }}>X</span>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--t3)',
      }}>
        <div style={{
          width: 16,
          height: 16,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--navy)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        Loading...
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0.95); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export function PageError({ 
  title = "Something went wrong",
  message = "Please try again or refresh the page",
  action 
}: { 
  title?: string
  message?: string
  action?: React.ReactNode 
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      textAlign: 'center',
      minHeight: 300,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 16,
        background: 'var(--red-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--red)' }}>
          error_outline
        </span>
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 600,
        color: 'var(--t1)',
        marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 14,
        color: 'var(--t3)',
        maxWidth: 300,
        marginBottom: action ? 20 : 0,
      }}>
        {message}
      </div>
      {action && (
        <div>{action}</div>
      )}
    </div>
  )
}

export function EmptyState({ 
  icon = "inbox",
  title = "No data yet",
  message = "Get started by adding your first item",
  action 
}: { 
  icon?: string
  title?: string
  message?: string
  action?: React.ReactNode 
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      textAlign: 'center',
      minHeight: 250,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--t3)' }}>
          {icon}
        </span>
      </div>
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--t1)',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 13,
        color: 'var(--t3)',
        maxWidth: 280,
        marginBottom: action ? 16 : 0,
      }}>
        {message}
      </div>
      {action && (
        <div>{action}</div>
      )}
    </div>
  )
}

export function HelperTip({ 
  title,
  steps 
}: { 
  title: string
  steps: string[] 
}) {
  return (
    <div style={{
      background: 'var(--navy-soft)',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--navy)',
        marginBottom: 12,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lightbulb</span>
        {title}
      </div>
      <ol style={{
        paddingLeft: 20,
        margin: 0,
        fontSize: 12,
        color: 'var(--t2)',
        lineHeight: 1.8,
      }}>
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  )
}