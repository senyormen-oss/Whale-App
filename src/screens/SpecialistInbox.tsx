import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'
import { useToast } from '../toast'
import { subscribeToTables } from '../lib/realtime'
import {
  fetchSpecialistInbox, fetchThread, sendSpecialistMessage, markSpecialistRead, uploadChatImage,
  type InboxItem,
} from '../lib/queries'
import type { Message } from '../types'
import { ArrowLeft, ArrowUp, ImageIcon, MessageSquareText, Loader2 } from '../icons'

/** List of client conversations on the specialist's own listing. */
export function SpecialistInbox({ specialistId, onOpen, onUnreadChange }: {
  specialistId: string
  onOpen: (item: InboxItem) => void
  onUnreadChange?: (count: number) => void
}) {
  const [items, setItems] = useState<InboxItem[] | null>(null)

  const load = useCallback(() => {
    fetchSpecialistInbox(specialistId)
      .then(data => {
        setItems(data)
        onUnreadChange?.(data.reduce((sum, i) => sum + i.unread, 0))
      })
      .catch(err => {
        console.error('Failed to load inbox', err)
        setItems(prev => prev ?? [])
      })
  }, [specialistId, onUnreadChange])

  useEffect(() => {
    load()
    return subscribeToTables(['messages', 'conversations'], load)
  }, [load])

  if (items === null) {
    return <Loader2 className="spin" size={18} color="#0ABAB5" strokeWidth={2} />
  }
  if (items.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No messages from clients yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onOpen(item)}
          className="glass"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', cursor: 'pointer', width: '100%',
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'rgba(10,186,181,0.15)',
            color: '#0ABAB5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
          }}>
            {item.clientName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.clientName}</p>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{item.lastTime}</span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.lastMessage || 'No messages yet'}
            </p>
          </div>
          {item.unread > 0 && (
            <span style={{
              background: '#0ABAB5', color: '#080808', borderRadius: '50%', width: 20, height: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0,
            }}>
              {item.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** One conversation seen from the specialist's side: their own messages are on the right. */
export function SpecialistChatThread({ conversationId, clientName, onBack }: {
  conversationId: string
  clientName: string
  onBack: () => void
}) {
  const { user } = useAuth()
  const { notify } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetchThread(conversationId)
      .then(data => {
        setMessages(data)
        markSpecialistRead(conversationId).catch(() => {})
      })
      .catch(err => console.error('Failed to load thread', err))
      .finally(() => setLoading(false))
  }, [conversationId])

  useEffect(() => {
    load()
    return subscribeToTables(['messages'], load)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(text: string, image?: string) {
    setSending(true)
    try {
      await sendSpecialistMessage(conversationId, text, image)
      load()
    } catch (err) {
      console.error('Failed to send', err)
      notify('Message was not sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    await send(text)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    try {
      const url = await uploadChatImage(file, user.id)
      await send(file.name, url)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to upload the photo.')
    }
  }

  return (
    <div style={{ background: '#080808', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="glass-dark" style={{ padding: '52px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            aria-label="Back"
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{clientName}</p>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Client</p>
          </div>
        </div>
      </div>

      <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <Loader2 className="spin" size={20} color="#0ABAB5" strokeWidth={2} style={{ alignSelf: 'center' }} />}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            <MessageSquareText size={32} color="rgba(255,255,255,0.2)" strokeWidth={1.5} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No messages yet.</p>
          </div>
        )}
        {messages.map(msg => {
          const mine = msg.from === 'them' // the specialist's own messages are stored as 'them'
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '75%', padding: msg.type === 'image' ? 6 : '10px 14px', fontSize: 14, lineHeight: 1.5, color: 'white',
                borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: mine ? 'linear-gradient(135deg, #0ABAB5 0%, #08918d 100%)' : 'rgba(255,255,255,0.08)',
              }}>
                {msg.type === 'image' && msg.image
                  ? <img src={msg.image} alt="Attachment" style={{ width: '100%', maxWidth: 220, borderRadius: 12, display: 'block' }} />
                  : <p style={{ margin: 0, overflowWrap: 'anywhere' }}>{msg.text}</p>}
                <p style={{ margin: msg.type === 'image' ? '4px 6px 2px' : '4px 0 0', fontSize: 10, textAlign: 'right', color: mine ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)' }}>{msg.time}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '8px 20px 28px', display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Send a photo"
          style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <ImageIcon size={18} strokeWidth={1.8} />
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFile} style={{ display: 'none' }} />
        <div className="glass" style={{ flex: 1, padding: '12px 16px', borderRadius: 20 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            maxLength={4000}
            placeholder="Reply to client…"
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 15, fontFamily: 'Outfit, sans-serif' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Send"
          style={{
            width: 48, height: 48, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: input.trim() ? '#0ABAB5' : 'rgba(255,255,255,0.08)', color: input.trim() ? '#080808' : 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowUp size={20} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
