import React, { useState, useMemo } from 'react';
import { EmptyState } from './EmptyState';

export function TradeTable({ trades = [], newTradeIds = new Set() }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Extract unique symbols for the filter dropdown
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(trades.map((t) => t.symbol));
    return Array.from(symbols).sort();
  }, [trades]);

  // Filtered dataset
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      const matchesSymbol =
        selectedSymbol === 'ALL' || trade.symbol === selectedSymbol;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        trade.tradeId.toLowerCase().includes(q) ||
        trade.client.toLowerCase().includes(q) ||
        trade.symbol.toLowerCase().includes(q);

      return matchesSymbol && matchesSearch;
    });
  }, [trades, selectedSymbol, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedTrades = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredTrades.slice(startIndex, startIndex + pageSize);
  }, [filteredTrades, safePage, pageSize]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSymbolChange = (e) => {
    setSelectedSymbol(e.target.value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  // Determine current page count display
  const displayedRowCount = Math.min(pageSize, paginatedTrades.length);
  const isFiltered = selectedSymbol !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <div className="table-card">
      <div className="table-toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrapper">
            <svg
              className="search-svg-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search Trade ID, Client..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                className="clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-select-wrapper">
            <select
              className="select-filter"
              value={selectedSymbol}
              onChange={handleSymbolChange}
            >
              <option value="ALL">All Symbols ({uniqueSymbols.length})</option>
              {uniqueSymbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="toolbar-right">
          <span className="record-count-text tabular-nums">
            {filteredTrades.length > 0 ? (
              <>
                Showing <strong>{displayedRowCount.toLocaleString()}</strong> of{' '}
                <strong>{filteredTrades.length.toLocaleString()}</strong> trades
                {isFiltered && (
                  <span className="text-muted"> ({trades.length.toLocaleString()} total)</span>
                )}
              </>
            ) : (
              <span>Showing <strong>0</strong> of <strong>0</strong> trades</span>
            )}
          </span>

          <select
            className="select-filter rows-select"
            value={pageSize}
            onChange={handlePageSizeChange}
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        {paginatedTrades.length > 0 ? (
          <table className="trade-data-table">
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Client</th>
                <th>Symbol</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Price (₹)</th>
                <th className="text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade) => {
                const isNew = newTradeIds.has(trade.tradeId);
                return (
                  <tr key={trade.tradeId} className={isNew ? 'row-new-arrival' : ''}>
                    <td className="monospace font-semibold text-primary">
                      {trade.tradeId}
                      {isNew && <span className="badge-new-pill">NEW</span>}
                    </td>
                    <td className="monospace text-secondary">{trade.client}</td>
                    <td>
                      <span className="symbol-tag">{trade.symbol}</span>
                    </td>
                    <td className="text-right monospace tabular-nums">
                      {Number(trade.quantity).toLocaleString()}
                    </td>
                    <td className="text-right monospace font-semibold text-price tabular-nums">
                      ₹{Number(trade.price).toFixed(2)}
                    </td>
                    <td className="text-right monospace text-muted text-sm tabular-nums">
                      {new Date(trade.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="No Matching Trades"
            message={
              searchQuery || selectedSymbol !== 'ALL'
                ? 'Try adjusting your search query or symbol filter.'
                : 'No trades are currently available.'
            }
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <div className="pagination-info tabular-nums">
            Page {safePage} of {totalPages}
          </div>
          <div className="pagination-buttons">
            <button
              className="btn-page"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              « First
            </button>
            <button
              className="btn-page"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              ‹ Prev
            </button>
            <span className="page-indicator tabular-nums">{safePage}</span>
            <button
              className="btn-page"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next ›
            </button>
            <button
              className="btn-page"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
