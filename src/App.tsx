import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import SearchScreen from './screens/SearchScreen'
import SpecialistScreen from './screens/SpecialistScreen'
import BookingScreen from './screens/BookingScreen'
import BookingsScreen from './screens/BookingsScreen'
import ChatScreen from './screens/ChatScreen'
import DashboardScreen from './screens/DashboardScreen'
import AuthScreen from './screens/AuthScreen'
import type { Screen, TabName } from './types'
import { useAppStore } from './store'
import { useI18n } from './i18n'
import { useAuth } from './auth'
import { useSpecialists } from './specialistsData'
import { Home, Search, ClipboardList, MessageCircle, User, Loader2, type IconType } from './icons'

const TABS: { name: TabName; icon: IconType; label: Parameters<typeof import('./i18n').t>[0] }[] = [
  { name: 'home',     icon: Home,          label: 'nav.home' },
  { name: 'explore',  icon: Search,        label: 'nav.explore' },
  { name: 'bookings', icon: ClipboardList, label: 'nav.bookings' },
  { name: 'messages', icon: MessageCircle, label: 'nav.messages' },
  { name: 'profile',  icon: User,          label: 'nav.profile' },
]

function BottomNav({ activeTab, onTabChange, unreadMessages }: {
  activeTab: TabName
  onTabChange: (tab: TabName) => void
  unreadMessages: number
}) {
  const { t } = useI18n()
  const index = Math.max(0, TABS.findIndex(tab => tab.name === activeTab))
  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 100,
      }}
    >
      <div
        className="glass-dark nav-bar"
        style={{ position: 'relative', display: 'flex', padding: '8px 8px 24px', borderRadius: '24px 24px 0 0' }}
      >
        {/* Sliding highlight: glides from tab to tab */}
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 8, bottom: 24, left: 8, width: `calc((100% - 16px) / ${TABS.length})`,
            transform: `translateX(${index * 100}%)`, transition: 'transform 0.42s cubic-bezier(.34,1.2,.5,1)',
            borderRadius: 16, background: 'rgba(10,186,181,0.15)',
          }}
        />
        {TABS.map(tab => {
          const isActive = activeTab === tab.name
          const Icon = tab.icon
          return (
            <button
              key={tab.name}
              onClick={() => onTabChange(tab.name)}
              aria-current={isActive ? 'page' : undefined}
              className="nav-tab"
              style={{
                position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 0', borderRadius: 16, border: 'none', background: 'transparent', cursor: 'pointer',
              }}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.3 : 1.8}
                color={isActive ? 'var(--accent-text)' : 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))'}
                style={{ transform: isActive ? 'translateY(-1px) scale(1.12)' : 'scale(1)', transition: 'transform 0.3s cubic-bezier(.34,1.4,.5,1), stroke 0.25s ease' }}
              />
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent-text)' : 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))',
                transition: 'color 0.25s ease',
              }}>
                {t(tab.label)}
              </span>
              {tab.name === 'messages' && unreadMessages > 0 && (
                <span className="pop-in" style={{
                  position: 'absolute', top: 2, left: '55%',
                  background: '#0ABAB5', borderRadius: 10, minWidth: 16, height: 16, padding: '0 4px', fontSize: 9, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#080808', border: '2px solid var(--bg)', boxSizing: 'content-box',
                }}>
                  {unreadMessages}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <Loader2 className="spin" size={30} color="var(--accent-text)" strokeWidth={2} />
    </div>
  )
}

export default function App() {
  const { t } = useI18n()
  const { user, loading: authLoading, recovering } = useAuth()
  const { loading: specialistsLoading, error: specialistsError } = useSpecialists()

  if (authLoading) return <LoadingScreen />
  if (!user || recovering) return <AuthScreen />
  if (specialistsLoading) return <LoadingScreen />
  if (specialistsError) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: '#ff4d6d', padding: 32, textAlign: 'center', fontSize: 14, flexDirection: 'column',
      }}>
        {t('app.loadFailed')}
        <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 12, border: 'none', background: '#0ABAB5', color: '#080808', fontWeight: 800 }}>{t('app.reload')}</button>
      </div>
    )
  }

  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const [activeTab, setActiveTab] = useState<TabName>('home')
  const [screenStack, setScreenStack] = useState<Screen[]>(() => {
    // Deep link from the "share profile" button: https://site/#specialist/<id>
    const m = window.location.hash.match(/^#specialist\/([\w-]+)$/)
    return m ? [{ name: 'home' }, { name: 'specialist', id: m[1] }] : [{ name: 'home' }]
  })
  const { conversations } = useAppStore()

  const currentScreen = screenStack[screenStack.length - 1]
  const unreadMessages = conversations.reduce((sum, c) => sum + c.unread, 0)

  function navigate(screen: Screen) {
    setScreenStack(prev => [...prev, screen])

    // Sync tab indicator
    if (screen.name === 'home') setActiveTab('home')
    else if (screen.name === 'search') setActiveTab('explore')
    else if (screen.name === 'bookings') setActiveTab('bookings')
    else if (screen.name === 'chats' || screen.name === 'chat') setActiveTab('messages')
    else if (screen.name === 'dashboard') setActiveTab('profile')
  }

  function goBack() {
    if (screenStack.length > 1) {
      setScreenStack(prev => prev.slice(0, -1))
    }
  }

  function handleTabChange(tab: TabName) {
    setActiveTab(tab)
    switch (tab) {
      case 'home':     setScreenStack([{ name: 'home' }]); break
      case 'explore':  setScreenStack([{ name: 'search' }]); break
      case 'bookings': setScreenStack([{ name: 'bookings' }]); break
      case 'messages': setScreenStack([{ name: 'chats' }]); break
      case 'profile':  setScreenStack([{ name: 'dashboard' }]); break
    }
  }

  function renderScreen(screen: Screen) {
    switch (screen.name) {
      case 'home':
        return <HomeScreen onNavigate={navigate} />
      case 'search':
        return <SearchScreen initialCategory={screen.category} initialQuery={screen.query} onNavigate={navigate} />
      case 'specialist':
        return <SpecialistScreen specialistId={screen.id} onNavigate={navigate} onBack={goBack} />
      case 'booking':
        return <BookingScreen specialistId={screen.specialistId} onNavigate={navigate} onBack={goBack} />
      case 'bookings':
        return <BookingsScreen onNavigate={navigate} />
      case 'chats':
        return <ChatScreen onNavigate={navigate} onBack={goBack} />
      case 'chat':
        return <ChatScreen conversationId={screen.conversationId} onNavigate={navigate} onBack={goBack} />
      case 'dashboard':
        return <DashboardScreen onNavigate={navigate} />
      default:
        return <HomeScreen onNavigate={navigate} />
    }
  }

  const showBottomNav = !['booking', 'specialist', 'chat'].includes(currentScreen.name)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-outer)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      {/* Desktop backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'radial-gradient(ellipse at 30% 20%, rgba(10,186,181,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(10,186,181,0.04) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      {/* App shell */}
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          minHeight: '100vh',
          position: 'relative',
          background: 'var(--bg)',
          backgroundImage: 'var(--shell-glow)',
          boxShadow: 'var(--shell-shadow)',
          overflow: 'hidden',
        }}
      >
        {/* Screen content */}
        <div
          key={currentScreen.name + (currentScreen.name === 'specialist' ? (currentScreen as any).id : '') + (currentScreen.name === 'chat' ? (currentScreen as any).conversationId : '')}
          className="screen-enter"
          style={{ minHeight: '100vh' }}
        >
          {renderScreen(currentScreen)}
        </div>

        {/* Bottom nav */}
        {showBottomNav && (
          <BottomNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            unreadMessages={unreadMessages}
          />
        )}
      </div>
    </div>
  )
}
