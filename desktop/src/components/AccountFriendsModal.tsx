import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  Check,
  Copy,
  Send,
  Shield,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { FriendPeer, UserProfile } from '../types';

export type AccountTabId = 'profile' | 'friends';

interface AccountFriendsModalProps {
  open: boolean;
  initialTab?: AccountTabId;
  profile: UserProfile;
  friends: FriendPeer[];
  currentBookTitle?: string;
  onClose: () => void;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onAddFriend: (code: string, name: string) => void;
  onSendMessage: (friendCode: string, text: string) => void;
  cloudAccountSection?: React.ReactNode;
}

export const AccountFriendsModal: React.FC<AccountFriendsModalProps> = ({
  open,
  initialTab = 'profile',
  profile,
  friends,
  currentBookTitle,
  onClose,
  onUpdateProfile,
  onAddFriend,
  onSendMessage,
  cloudAccountSection,
}) => {
  const [tab, setTab] = useState<AccountTabId>(initialTab);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedFriendCode, setSelectedFriendCode] = useState<string>(
    friends[0]?.peerCode ?? ''
  );
  const [newFriendCode, setNewFriendCode] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  React.useEffect(() => {
    if (open && friends.length > 0 && !friends.some((f) => f.peerCode === selectedFriendCode)) {
      setSelectedFriendCode(friends[0].peerCode);
    }
  }, [open, friends, selectedFriendCode]);

  if (!open) return null;

  const selectedFriend = friends.find((f) => f.peerCode === selectedFriendCode) ?? friends[0];

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(profile.peerCode).catch(() => undefined);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateProfile({ avatarDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newFriendCode.trim().toUpperCase();
    const name = newFriendName.trim();
    if (!code || !name) return;
    onAddFriend(code, name);
    setSelectedFriendCode(code);
    setNewFriendCode('');
    setNewFriendName('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !chatDraft.trim()) return;
    onSendMessage(selectedFriend.peerCode, chatDraft.trim());
    setChatDraft('');
  };

  const initial = (profile.username.trim()[0] || 'L').toUpperCase();

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 luma-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[780px] max-h-[85vh] flex flex-col rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden luma-modal-pop"
      >
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--luma-border)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center p-1 rounded-lg bg-[var(--luma-surface-alt)]">
              <button
                type="button"
                onClick={() => setTab('profile')}
                className={`h-7 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  tab === 'profile'
                    ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Mi Cuenta
              </button>
              <button
                type="button"
                onClick={() => setTab('friends')}
                className={`h-7 px-3 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                  tab === 'friends'
                    ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Amigos ({friends.length})
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {tab === 'profile' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cloudAccountSection}

            {/* Avatar + Name + Code */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-5 border-b border-[var(--luma-border)]">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Cambiar foto de perfil"
                className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] flex items-center justify-center shrink-0 group"
              >
                {profile.avatarDataUrl ? (
                  <img
                    src={profile.avatarDataUrl}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-[var(--luma-accent)]">{initial}</span>
                )}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                </div>
              </button>

              <div className="flex-1 min-w-0 space-y-3 w-full">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                    Nombre de perfil local
                  </label>
                  <input
                    value={profile.username}
                    onChange={(e) => onUpdateProfile({ username: e.target.value })}
                    placeholder="Tu nombre en Luma"
                    className="w-full max-w-sm h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-sm font-medium outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-[var(--luma-ink-muted)]">Código de amigo:</span>
                  <span className="font-mono font-semibold text-[var(--luma-ink)]">
                    {profile.peerCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="h-7 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] inline-flex items-center gap-1.5 text-xs font-medium"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copiar código
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {currentBookTitle && (
              <div className="p-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] flex items-center gap-3 text-xs">
                <BookOpen className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />
                <span>
                  Lectura reciente compartible: <strong>{currentBookTitle}</strong>
                </span>
              </div>
            )}

            {/* Privacy Controls */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--luma-ink-muted)]">
                <Shield className="w-3.5 h-3.5" />
                <span>Privacidad local (sin cuentas en la nube)</span>
              </div>

              <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)]">
                {(
                  [
                    {
                      key: 'showOnlineStatus',
                      title: 'Mostrar estado de conexión',
                      desc: 'Permite que tus amigos sepan cuando estás leyendo en Luma.',
                    },
                    {
                      key: 'shareReadingBook',
                      title: 'Compartir libro actual',
                      desc: 'Muestra el título y avance de tu lectura activa a tus amigos.',
                    },
                    {
                      key: 'allowFriendChat',
                      title: 'Permitir mensajes y recomendaciones',
                      desc: 'Recibe recomendaciones de libros y notas rápidas de amigos.',
                    },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.key}
                    className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-semibold">{item.title}</div>
                      <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profile.privacy[item.key]}
                      onChange={(e) =>
                        onUpdateProfile({
                          privacy: { ...profile.privacy, [item.key]: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-[var(--luma-accent)]"
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
            {/* Left Friends List + Add Friend */}
            <div className="sm:w-[270px] shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--luma-border)] bg-[var(--luma-sidebar)] flex flex-col">
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
                {friends.map((fr) => {
                  const active = selectedFriend?.peerCode === fr.peerCode;
                  return (
                    <button
                      key={fr.peerCode}
                      type="button"
                      onClick={() => setSelectedFriendCode(fr.peerCode)}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition-colors ${
                        active
                          ? 'bg-[var(--luma-surface)] border border-[var(--luma-border)]'
                          : 'hover:bg-[var(--luma-surface-alt)] border border-transparent'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                        style={{ backgroundColor: fr.accentColor }}
                      >
                        {fr.displayName[0]?.toUpperCase() || 'A'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{fr.displayName}</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)] truncate">
                          {fr.readingBookTitle || fr.peerCode}
                        </div>
                        <div className="text-[10px] text-[var(--luma-ink-muted)] tabular-nums mt-0.5">
                          {fr.isOnline ? 'En línea' : 'Desconectado'} · {fr.readingProgressPct}%
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleAddFriendSubmit}
                className="p-3 border-t border-[var(--luma-border)] space-y-2 bg-[var(--luma-surface)]"
              >
                <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                  Añadir amigo por código
                </div>
                <input
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  placeholder="Nombre del amigo"
                  className="w-full h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none"
                  required
                />
                <div className="flex gap-1.5">
                  <input
                    value={newFriendCode}
                    onChange={(e) => setNewFriendCode(e.target.value)}
                    placeholder="LUMA-1234"
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs font-mono outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="h-8 px-3 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold shrink-0"
                  >
                    Añadir
                  </button>
                </div>
              </form>
            </div>

            {/* Right Friend Activity & Messages */}
            <div className="flex-1 min-w-0 flex flex-col bg-[var(--luma-bg)]">
              {selectedFriend ? (
                <>
                  <div className="px-4 py-3 border-b border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {selectedFriend.displayName}
                      </div>
                      <div className="text-[11px] text-[var(--luma-ink-muted)] truncate tabular-nums">
                        {selectedFriend.peerCode} · Leyendo {selectedFriend.readingBookTitle} (
                        {selectedFriend.readingProgressPct}%)
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                    {selectedFriend.messages.length === 0 ? (
                      <p className="text-xs text-[var(--luma-ink-muted)] text-center py-8">
                        Envía una recomendación de libro o un saludo a {selectedFriend.displayName}.
                      </p>
                    ) : (
                      selectedFriend.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.isFromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[78%] px-3.5 py-2 rounded-xl text-xs leading-relaxed ${
                              m.isFromMe
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] text-[var(--luma-ink)]'
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={handleSendChat}
                    className="p-3 border-t border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-center gap-2"
                  >
                    <input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder={`Escribe un mensaje a ${selectedFriend.displayName}...`}
                      className="flex-1 h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none"
                    />
                    <button
                      type="submit"
                      className="h-9 px-3.5 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-[var(--luma-ink-muted)]">
                  Selecciona o añade un amigo para conversar y compartir lecturas.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
