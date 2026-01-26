import type { Contact } from '../types';
import { ContactTypeahead } from '../Shared';

interface RecipientSelectorProps {
  to: Contact[];
  cc: Contact[];
  bcc: Contact[];
  onToChange: (contacts: Contact[]) => void;
  onCcChange: (contacts: Contact[]) => void;
  onBccChange: (contacts: Contact[]) => void;
  showCcBcc?: boolean;
  onToggleCcBcc?: () => void;
}

export function RecipientSelector({
  to,
  cc,
  bcc,
  onToChange,
  onCcChange,
  onBccChange,
  showCcBcc = false,
  onToggleCcBcc,
}: RecipientSelectorProps) {
  return (
    <div className="recipient-selector">
      {/* To Field */}
      <div className="recipient-field">
        <ContactTypeahead
          label="To"
          selectedContacts={to}
          onContactsChange={onToChange}
          placeholder="Add recipients..."
        />
      </div>

      {/* CC/BCC Toggle */}
      {!showCcBcc && (
        <button className="cc-bcc-toggle" onClick={onToggleCcBcc}>
          + Add CC/BCC
        </button>
      )}

      {/* CC Field */}
      {showCcBcc && (
        <div className="recipient-field">
          <ContactTypeahead
            label="CC"
            selectedContacts={cc}
            onContactsChange={onCcChange}
            placeholder="Add CC recipients..."
          />
        </div>
      )}

      {/* BCC Field */}
      {showCcBcc && (
        <div className="recipient-field">
          <ContactTypeahead
            label="BCC"
            selectedContacts={bcc}
            onContactsChange={onBccChange}
            placeholder="Add BCC recipients..."
          />
        </div>
      )}
    </div>
  );
}
