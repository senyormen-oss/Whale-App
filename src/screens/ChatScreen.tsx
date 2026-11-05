import { useState, useRef, useEffect } from 'react'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { uploadChatImage } from '../lib/queries'
import {
  ArrowLeft, ImageIcon, Smile, ArrowUp, MessageSquareText, AlertCircle,
} from '../icons'

interface Props {
  conversationId?: string
  onNavigate: (screen: Screen) => void
  onBack: () => void
}

const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🔥', '🎉', '❤️', '👌', '😢']

function ConversationList({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { conversations } = useAppStore()
  const { specialists } = useSpecialists()

  return (
    <div style={{ background: '#080808', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, #0f1410 0%, #080808 100%)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Messages</h1>
      </div>

      {conversations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'rgba(255,255,255,0.4)' }}>
          <MessageSquareText size={44} color="rgba(255,255,255,0.25)" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <p>No conversations yet.<br />Book a specialist to start chatting.</p>
        </div>
      ) : (
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {conversations.map(conv => {
            const sp = specialists.find(s => s.id === conv.specialistId)
            if (!sp) return null
            return (
              <button
                key={conv.id}
                onClick={() => onNavigate({ name: 'chat', conversationId: conv.id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 18, border: 'none',
                  background: 'rgba(255,255,255,0.03)', textAlign: 'left', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={sp.avatar}
                    alt={sp.name}
                    style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', background: '#111' }}
                  />
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 13, height: 13, borderRadius: '50%',
                    background: sp.available ? '#4ade80' : 'rgba(255,255,255,0.25)', border: '2px solid #080808',
                  }} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'white' }}>{sp.name}</p>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{conv.lastTime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {conv.lastMessage}
                    </p>
                    {conv.unread > 0 && (
                      <span style={{
                        background: '#0ABAB5', borderRadius: '50%', width: 20, height: 20,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#080808', flexShrink: 0,
                      }}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChatThread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { conversations, messagesByConversation, sendMessage, markConversationRead, loadMessages } = useAppStore()
  const { specialists } = useSpecialists()
  const { user } = useAuth()
  const conv = conversations.find(c => c.id === conversationId)
  const sp = conv ? specialists.find(s => s.id === conv.specialistId) : null
  const messages = messagesByConversation[conversationId] ?? []
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    loadMessages(conversationId)
    if (conv && conv.unread > 0) markConversationRead(conversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  async function pushMine(partial: { text: string; type?: 'text' | 'image'; image?: string }) {
    await sendMessage(conversationId, partial)
  }

  function handleSend() {
    if (!input.trim()) return
    pushMine({ text: input.trim() })
    setInput('')
    setShowEmoji(false)
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadChatImage(file, user.id)
      await pushMine({ text: file.name, type: 'image', image: url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image.')
    } finally {
      setUploading(false)
    }
  }

  if (!sp) return null

  return (
    <div style={{ background: '#080808', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="glass-dark" style={{ padding: '52px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <div style={{ position: 'relative' }}>
            <img src={sp.avatar} alt={sp.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', background: '#111' }} />
            {sp.available && (
              <span style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: '#4ade80', border: '2px solid #111' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 1px', fontSize: 15, fontWeight: 700 }}>{sp.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: sp.available ? '#4ade80' : 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              {sp.available ? 'Accepting bookings' : 'Not accepting bookings'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        className="hide-scrollbar"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {/* Date separator */}
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: 20 }}>
            Today
          </span>
        </div>

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Say hello to {sp.name.split(' ')[0]} 👋
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            {msg.from === 'them' && (
              <img src={sp.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#111' }} />
            )}
            <div
              style={{
                maxWidth: '72%',
                padding: msg.type === 'image' ? 6 : '10px 14px',
                borderRadius: msg.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.from === 'me'
                  ? 'linear-gradient(135deg, #0ABAB5 0%, #08918d 100%)'
                  : 'rgba(255,255,255,0.08)',
                color: 'white',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {msg.type === 'image' && msg.image && (
                <img
                  src={msg.image}
                  alt={msg.text}
                  style={{ width: '100%', maxWidth: 220, borderRadius: 12, display: 'block', marginBottom: 4 }}
                />
              )}
              {msg.type !== 'image' && <p style={{ margin: '0 0 4px' }}>{msg.text}</p>}
              <p style={{ margin: msg.type === 'image' ? '4px 6px 2px' : 0, fontSize: 10, color: msg.from === 'me' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, padding: '0 20px 10px', overflowX: 'auto', alignItems: 'center' }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
            fontSize: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 500,
            opacity: uploading ? 0.5 : 1,
          }}
        >
          <ImageIcon size={13} strokeWidth={1.8} />
          {uploading ? 'Uploading…' : 'Photo'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChosen} style={{ display: 'none' }} />
      </div>

      {uploadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px 8px', color: '#ff4d6d', fontSize: 11.5 }}>
          <AlertCircle size={13} strokeWidth={2} />
          {uploadError}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="fade-in" style={{ display: 'flex', gap: 6, padding: '0 20px 10px', flexWrap: 'wrap' }}>
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setInput(prev => prev + e)}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 17, cursor: 'pointer' }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '0 20px 32px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div
          className="glass"
          style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '12px 16px', borderRadius: 20, gap: 10 }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Message..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'white', fontSize: 15, fontFamily: 'Outfit, sans-serif',
            }}
          />
          <button
            onClick={() => setShowEmoji(v => !v)}
            style={{ background: 'none', border: 'none', color: showEmoji ? '#0ABAB5' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}
          >
            <Smile size={18} strokeWidth={1.8} />
          </button>
        </div>
        <button
          onClick={handleSend}
          className={input.trim() ? 'tiffany-glow-sm' : ''}
          style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none',
            background: input.trim() ? '#0ABAB5' : 'rgba(255,255,255,0.08)',
            color: input.trim() ? '#080808' : 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          <ArrowUp size={20} strokeWidth={2.2} />
        </button>
      </div>

    </div>
  )
}

export default function ChatScreen({ conversationId, onNavigate, onBack }: Props) {
  if (conversationId) {
    return <ChatThread conversationId={conversationId} onBack={onBack} />
  }
  return <ConversationList onNavigate={onNavigate} />
}
