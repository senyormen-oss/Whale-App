import { useState, useRef, useEffect } from 'react'
import type { Screen } from '../types'
import { useAppStore } from '../store'
import { useAuth } from '../auth'
import { useSpecialists } from '../specialistsData'
import { uploadChatImage } from '../lib/queries'
import { useI18n, localizeSystemMessage } from '../i18n'
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
  const { t } = useI18n()
  const { conversations } = useAppStore()
  const { specialists } = useSpecialists()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%', paddingBottom: 100 }}>
      <div style={{ padding: '56px 20px 20px', background: 'linear-gradient(180deg, var(--bg-header) 0%, var(--bg) 100%)' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t('chat.title')}</h1>
      </div>

      {conversations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))' }}>
          <MessageSquareText size={44} color="rgba(var(--fg-rgb),calc(0.25 * var(--tb)))" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <p>{t('chat.empty')}</p>
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
                  background: 'rgba(var(--fg-rgb),0.03)', textAlign: 'left', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--fg-rgb),0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(var(--fg-rgb),0.03)')}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={sp.avatar}
                    alt={sp.name}
                    style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)' }}
                  />
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 13, height: 13, borderRadius: '50%',
                    background: sp.available ? 'var(--ok)' : 'rgba(var(--fg-rgb),0.25)', border: '2px solid var(--bg)',
                  }} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{sp.name}</p>
                    <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.35 * var(--tb)))', flexShrink: 0 }}>{conv.lastTime}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg-rgb),calc(0.45 * var(--tb)))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {localizeSystemMessage(conv.lastMessage)}
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
  const { t } = useI18n()
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
      setUploadError(err instanceof Error ? err.message : t('err.upload'))
    } finally {
      setUploading(false)
    }
  }

  if (!sp) return null

  return (
    <div style={{ background: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="glass-dark" style={{ padding: '52px 20px 14px', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            aria-label={t('common.back')}
            style={{
              background: 'rgba(var(--fg-rgb),0.08)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <div style={{ position: 'relative' }}>
            <img src={sp.avatar} alt={sp.name} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', background: 'var(--surface)' }} />
            {sp.available && (
              <span style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--surface)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 1px', fontSize: 15, fontWeight: 700 }}>{sp.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: sp.available ? 'var(--ok)' : 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))', fontWeight: 500 }}>
              {sp.available ? t('chat.accepting') : t('chat.notAccepting')}
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
          <span style={{ fontSize: 11, color: 'rgba(var(--fg-rgb),calc(0.3 * var(--tb)))', background: 'rgba(var(--fg-rgb),0.06)', padding: '4px 12px', borderRadius: 20 }}>
            {t('chat.today')}
          </span>
        </div>

        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(var(--fg-rgb),calc(0.35 * var(--tb)))', fontSize: 13 }}>
            {t('chat.sayHello', { name: sp.name.split(' ')[0] })} 👋
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
              <img src={sp.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--surface)' }} />
            )}
            <div
              style={{
                maxWidth: '72%',
                padding: msg.type === 'image' ? 6 : '10px 14px',
                borderRadius: msg.from === 'me' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.from === 'me'
                  ? 'linear-gradient(135deg, #0ABAB5 0%, #08918d 100%)'
                  : 'rgba(var(--fg-rgb),0.08)',
                color: 'var(--ink)',
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
              {msg.type !== 'image' && <p style={{ margin: '0 0 4px', overflowWrap: 'anywhere' }}>{localizeSystemMessage(msg.text)}</p>}
              <p style={{ margin: msg.type === 'image' ? '4px 6px 2px' : 0, fontSize: 10, color: msg.from === 'me' ? 'rgba(0,0,0,0.45)' : 'rgba(var(--fg-rgb),calc(0.35 * var(--tb)))', textAlign: 'right' }}>
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
            background: 'rgba(var(--fg-rgb),0.07)', color: 'rgba(var(--fg-rgb),calc(0.7 * var(--tb)))',
            fontSize: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 500,
            opacity: uploading ? 0.5 : 1,
          }}
        >
          <ImageIcon size={13} strokeWidth={1.8} />
          {uploading ? t('chat.uploading') : t('chat.photo')}
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
              style={{ background: 'rgba(var(--fg-rgb),0.06)', border: 'none', borderRadius: 10, width: 34, height: 34, fontSize: 17, cursor: 'pointer' }}
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
            placeholder={t('chat.placeholder')}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--ink)', fontSize: 15, fontFamily: 'Outfit, sans-serif',
            }}
          />
          <button
            onClick={() => setShowEmoji(v => !v)}
            aria-label={t('chat.emoji')}
            style={{ background: 'none', border: 'none', color: showEmoji ? 'var(--accent-text)' : 'rgba(var(--fg-rgb),calc(0.4 * var(--tb)))', display: 'flex', alignItems: 'center' }}
          >
            <Smile size={18} strokeWidth={1.8} />
          </button>
        </div>
        <button
          onClick={handleSend}
          aria-label={t('chat.send')}
          className={input.trim() ? 'tiffany-glow-sm' : ''}
          style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none',
            background: input.trim() ? '#0ABAB5' : 'rgba(var(--fg-rgb),0.08)',
            color: input.trim() ? '#080808' : 'rgba(var(--fg-rgb),calc(0.3 * var(--tb)))',
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
