import { useState, useEffect, useRef, useCallback } from 'react';
import type { Contact } from '../types';
import { ContactChip } from './ContactChip';

interface ContactTypeaheadProps {
  selectedContacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
  placeholder?: string;
  label?: string;
  stakeholderContacts?: Contact[];
  maxContacts?: number;
}

// Mock contact data for demo - in production this would come from API
const DEMO_CONTACTS: Contact[] = [
  { id: '1', email: 'sarah.johnson@acmecorp.com', name: 'Sarah Johnson', title: 'VP of Engineering', company: 'Acme Corp', source: 'stakeholder' },
  { id: '2', email: 'mike.chen@acmecorp.com', name: 'Mike Chen', title: 'Product Manager', company: 'Acme Corp', source: 'stakeholder' },
  { id: '3', email: 'jessica.liu@acmecorp.com', name: 'Jessica Liu', title: 'CTO', company: 'Acme Corp', source: 'stakeholder' },
  { id: '4', email: 'john.smith@example.com', name: 'John Smith', title: 'Director', company: 'Example Inc', source: 'recent' },
  { id: '5', email: 'amy.wong@demo.com', name: 'Amy Wong', title: 'Success Manager', company: 'Demo Co', source: 'recent' },
];

export function ContactTypeahead({
  selectedContacts,
  onContactsChange,
  placeholder = 'Search contacts...',
  label,
  stakeholderContacts = DEMO_CONTACTS,
  maxContacts,
}: ContactTypeaheadProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter contacts based on query
  const searchContacts = useCallback(async (searchQuery: string) => {
    setIsLoading(true);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = stakeholderContacts.filter(
      (contact) =>
        !selectedContacts.find((c) => c.id === contact.id) &&
        (contact.name.toLowerCase().includes(lowerQuery) ||
          contact.email.toLowerCase().includes(lowerQuery) ||
          contact.company?.toLowerCase().includes(lowerQuery))
    );

    setSuggestions(filtered.slice(0, 5));
    setIsLoading(false);
  }, [stakeholderContacts, selectedContacts]);

  useEffect(() => {
    if (query.length >= 1) {
      searchContacts(query);
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [query, searchContacts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (contact: Contact) => {
    if (maxContacts && selectedContacts.length >= maxContacts) return;
    onContactsChange([...selectedContacts, contact]);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleRemove = (contactId: string) => {
    onContactsChange(selectedContacts.filter((c) => c.id !== contactId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Backspace' && query === '' && selectedContacts.length > 0) {
      handleRemove(selectedContacts[selectedContacts.length - 1].id);
    }
  };

  // Check if we can add a manual email
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleAddManualEmail = () => {
    if (isValidEmail(query) && !selectedContacts.find((c) => c.email === query)) {
      const newContact: Contact = {
        id: `manual-${Date.now()}`,
        email: query,
        name: query.split('@')[0],
        source: 'manual',
      };
      handleSelect(newContact);
    }
  };

  return (
    <div className="contact-typeahead">
      {label && <label className="typeahead-label">{label}</label>}

      <div className="typeahead-input-container">
        {/* Selected chips */}
        <div className="selected-chips">
          {selectedContacts.map((contact) => (
            <ContactChip
              key={contact.id}
              contact={contact}
              size="sm"
              onRemove={() => handleRemove(contact.id)}
            />
          ))}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && setIsOpen(true)}
          placeholder={selectedContacts.length === 0 ? placeholder : ''}
          disabled={maxContacts ? selectedContacts.length >= maxContacts : false}
          className="typeahead-input"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div ref={dropdownRef} className="typeahead-dropdown">
          {isLoading ? (
            <div className="typeahead-loading">Searching...</div>
          ) : suggestions.length > 0 ? (
            <>
              {suggestions.map((contact, index) => (
                <div
                  key={contact.id}
                  className={`typeahead-option ${index === highlightedIndex ? 'highlighted' : ''}`}
                  onClick={() => handleSelect(contact)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <ContactChip contact={contact} showEmail />
                  {contact.title && (
                    <span className="contact-title">{contact.title}</span>
                  )}
                </div>
              ))}
            </>
          ) : isValidEmail(query) ? (
            <div
              className="typeahead-option typeahead-add-manual"
              onClick={handleAddManualEmail}
            >
              <span className="add-icon">+</span>
              <span>Add "{query}"</span>
            </div>
          ) : (
            <div className="typeahead-empty">
              No contacts found. Enter a valid email to add.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
