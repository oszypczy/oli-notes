import { SearchIcon, CloseIcon } from '../icons';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className={styles.wrapper}>
      <SearchIcon className={styles.searchIcon} />
      <input
        className={styles.input}
        type="text"
        placeholder="Szukaj przedmiotu..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className={styles.clearBtn} onClick={() => onChange('')}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
