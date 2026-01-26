import type { Contact } from '../types';

interface ContactChipProps {
  contact: Contact;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  showEmail?: boolean;
}

export function ContactChip({
  contact,
  onRemove,
  size = 'md',
  showEmail = false,
}: ContactChipProps) {
  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sourceColors: Record<Contact['source'], string> = {
    stakeholder: '#e63946',
    google: '#4285f4',
    recent: '#22c55e',
    manual: '#666',
  };

  return (
    <div className={`contact-chip contact-chip-${size}`}>
      <div
        className="contact-avatar"
        style={{
          backgroundImage: contact.avatarUrl ? `url(${contact.avatarUrl})` : undefined,
          backgroundColor: contact.avatarUrl ? undefined : sourceColors[contact.source],
        }}
      >
        {!contact.avatarUrl && initials}
      </div>
      <div className="contact-info">
        <span className="contact-name">{contact.name}</span>
        {showEmail && <span className="contact-email">{contact.email}</span>}
      </div>
      {onRemove && (
        <button className="contact-remove" onClick={onRemove}>
          ✕
        </button>
      )}
    </div>
  );
}
