/**
 * useGridNavigation Hook
 * PRD-272: Keyboard Navigation
 *
 * Implements keyboard navigation for grid/table layouts.
 * Supports arrow keys in 2D grid, Home/End, Ctrl+Home/End.
 */

import { useState, useRef, useCallback } from 'react';
import type { GridNavigationOptions, GridPosition } from '../types/keyboard';

/**
 * Return type for useGridNavigation hook
 */
export interface UseGridNavigationReturn<T extends HTMLElement> {
  /** Current focused position */
  position: GridPosition;
  /** Set position programmatically */
  setPosition: (position: GridPosition) => void;
  /** Get tabIndex for a cell */
  getTabIndex: (row: number, column: number) => 0 | -1;
  /** Get ref setter for a cell */
  setRef: (row: number, column: number) => (el: T | null) => void;
  /** Keyboard event handler */
  handleKeyDown: (e: React.KeyboardEvent, row: number, column: number) => void;
  /** Focus a specific cell */
  focusCell: (row: number, column: number) => void;
}

/**
 * Implement grid navigation for data tables
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const DataTable: React.FC<{ data: DataRow[] }> = ({ data }) => {
 *   const columnCount = Object.keys(data[0]).length;
 *   const rowCount = data.length;
 *
 *   const { position, getTabIndex, setRef, handleKeyDown } = useGridNavigation({
 *     columnCount,
 *     rowCount,
 *   });
 *
 *   return (
 *     <table role="grid">
 *       <tbody>
 *         {data.map((row, rowIndex) => (
 *           <tr key={rowIndex}>
 *             {Object.values(row).map((cell, colIndex) => (
 *               <td
 *                 key={colIndex}
 *                 ref={setRef(rowIndex, colIndex)}
 *                 tabIndex={getTabIndex(rowIndex, colIndex)}
 *                 onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
 *                 role="gridcell"
 *               >
 *                 {cell}
 *               </td>
 *             ))}
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   );
 * };
 * ```
 */
export const useGridNavigation = <T extends HTMLElement>(
  options: GridNavigationOptions
): UseGridNavigationReturn<T> => {
  const {
    columnCount,
    rowCount,
    loopRows = false,
    loopColumns = false,
    onCellChange,
  } = options;

  const [position, setPositionState] = useState<GridPosition>({ row: 0, column: 0 });
  const cellRefs = useRef<Map<string, T | null>>(new Map());

  /**
   * Get cell key for ref storage
   */
  const getCellKey = (row: number, column: number): string => `${row}-${column}`;

  /**
   * Clamp position to valid range
   */
  const clampPosition = useCallback(
    (pos: GridPosition): GridPosition => ({
      row: Math.max(0, Math.min(pos.row, rowCount - 1)),
      column: Math.max(0, Math.min(pos.column, columnCount - 1)),
    }),
    [rowCount, columnCount]
  );

  /**
   * Focus a specific cell
   */
  const focusCell = useCallback(
    (row: number, column: number): void => {
      const clampedPos = clampPosition({ row, column });
      setPositionState(clampedPos);
      onCellChange?.(clampedPos.row, clampedPos.column);

      // Focus the element
      requestAnimationFrame(() => {
        const key = getCellKey(clampedPos.row, clampedPos.column);
        cellRefs.current.get(key)?.focus();
      });
    },
    [clampPosition, onCellChange]
  );

  /**
   * Set position programmatically
   */
  const setPosition = useCallback(
    (newPosition: GridPosition): void => {
      focusCell(newPosition.row, newPosition.column);
    },
    [focusCell]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, row: number, column: number): void => {
      let nextRow = row;
      let nextColumn = column;

      switch (e.key) {
        // Basic arrow navigation
        case 'ArrowRight':
          if (column < columnCount - 1) {
            nextColumn = column + 1;
          } else if (loopColumns) {
            nextColumn = 0;
          }
          break;

        case 'ArrowLeft':
          if (column > 0) {
            nextColumn = column - 1;
          } else if (loopColumns) {
            nextColumn = columnCount - 1;
          }
          break;

        case 'ArrowDown':
          if (row < rowCount - 1) {
            nextRow = row + 1;
          } else if (loopRows) {
            nextRow = 0;
          }
          break;

        case 'ArrowUp':
          if (row > 0) {
            nextRow = row - 1;
          } else if (loopRows) {
            nextRow = rowCount - 1;
          }
          break;

        // Home/End within row
        case 'Home':
          if (e.ctrlKey) {
            // Go to first cell in grid
            nextRow = 0;
            nextColumn = 0;
          } else {
            // Go to first cell in row
            nextColumn = 0;
          }
          break;

        case 'End':
          if (e.ctrlKey) {
            // Go to last cell in grid
            nextRow = rowCount - 1;
            nextColumn = columnCount - 1;
          } else {
            // Go to last cell in row
            nextColumn = columnCount - 1;
          }
          break;

        // Page navigation
        case 'PageUp':
          nextRow = Math.max(0, row - 10);
          break;

        case 'PageDown':
          nextRow = Math.min(rowCount - 1, row + 10);
          break;

        default:
          return;
      }

      if (nextRow !== row || nextColumn !== column) {
        e.preventDefault();
        focusCell(nextRow, nextColumn);
      }
    },
    [columnCount, rowCount, loopRows, loopColumns, focusCell]
  );

  /**
   * Get tabIndex for a cell
   */
  const getTabIndex = useCallback(
    (row: number, column: number): 0 | -1 => {
      return row === position.row && column === position.column ? 0 : -1;
    },
    [position]
  );

  /**
   * Set ref for a cell
   */
  const setRef = useCallback(
    (row: number, column: number) => (el: T | null) => {
      const key = getCellKey(row, column);
      if (el) {
        cellRefs.current.set(key, el);
      } else {
        cellRefs.current.delete(key);
      }
    },
    []
  );

  return {
    position,
    setPosition,
    getTabIndex,
    setRef,
    handleKeyDown,
    focusCell,
  };
};

export default useGridNavigation;
