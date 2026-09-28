import React, { useState, useMemo, useEffect } from 'react';
import type { ExtractedEmail } from '../types';
import * as XLSX from 'xlsx';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';
import SparklesIcon from './icons/SparklesIcon';
import MagnifyingGlassIcon from './icons/MagnifyingGlassIcon';
import XCircleIcon from './icons/XCircleIcon';
import LinkIcon from './icons/LinkIcon';
import ShieldCheckIcon from './icons/ShieldCheckIcon';
import { User, Building2, Send, Globe, Phone, Briefcase, ShieldAlert, CheckCircle2, Copy } from 'lucide-react';

interface ResultsDisplayProps {
  results: ExtractedEmail[];
  isLoading: boolean;
  error: string | null;
  progressMessage: string | null;
  onClearResults: () => void;
  onDeduplicateCompanies?: () => void;
  avoidDuplicateCompanies?: boolean;
  onSendToValidator?: () => void;
  onSendToEmailSender?: (selectedLeads?: ExtractedEmail[]) => void;
  onDeepCrawlCompanyWebsites?: () => void;
  isDeepCrawling?: boolean;
}

const CopyButton: React.FC<{ textToCopy: string; title?: string }> = ({ textToCopy, title = "Copy to clipboard" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md bg-gray-700/50 hover:bg-blue-600 text-gray-300 hover:text-white transition-all duration-200"
      aria-label="Copy"
      title={title}
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-white" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
    </button>
  );
};

const SkeletonLoader: React.FC = () => (
  <div className="w-full h-full overflow-hidden p-4">
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-700/50 rounded w-full mb-6"></div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex space-x-4 items-center border-b border-gray-800 pb-4">
          <div className="w-1/4 h-4 bg-gray-700/30 rounded"></div>
          <div className="w-1/4 h-4 bg-gray-700/30 rounded"></div>
          <div className="w-1/6 h-4 bg-gray-700/30 rounded"></div>
          <div className="w-1/6 h-4 bg-gray-700/30 rounded"></div>
          <div className="w-10 h-8 bg-gray-700/30 rounded ml-auto"></div>
        </div>
      ))}
    </div>
  </div>
);

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ 
  results, 
  isLoading, 
  error, 
  progressMessage, 
  onClearResults,
  onDeduplicateCompanies,
  avoidDuplicateCompanies = true,
  onSendToValidator,
  onSendToEmailSender,
  onDeepCrawlCompanyWebsites,
  isDeepCrawling
}) => {
  const [allCopied, setAllCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState('all'); // 'all', 'yes', 'no'
  const [nameTypeFilter, setNameTypeFilter] = useState<'all' | 'with_role' | 'personal' | 'role'>('all');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'with_phone'>('all');

  // High-Performance Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const uniqueCompaniesCount = useMemo(() => {
    const set = new Set<string>();
    results.forEach(r => {
      const comp = r.companyName?.trim().toLowerCase() || r.email.split('@')[1];
      if (comp) set.add(comp);
    });
    return set.size;
  }, [results]);

  const phoneCount = useMemo(() => {
    return results.filter(r => r.phone && r.phone.trim().length > 5).length;
  }, [results]);

  const roleCount = useMemo(() => {
    return results.filter(r => r.role && r.role.trim().length > 2).length;
  }, [results]);

  const countriesWithCounts = useMemo(() => {
    if (results.length === 0) return [];
    
    const counts = results.reduce((acc, r) => {
      if (r.country && r.country !== 'N/A') {
        acc[r.country] = (acc[r.country] || 0) + 1;
      }
      return acc;
    }, {} as { [key: string]: number });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [results]);

  const filteredResults = useMemo(() => {
    return results.filter(result => {
      const q = searchFilter.toLowerCase();
      const searchMatch = q
        ? result.companyName?.toLowerCase().includes(q) || 
          result.email.toLowerCase().includes(q) ||
          (result.firstName && result.firstName.toLowerCase().includes(q)) ||
          (result.lastName && result.lastName.toLowerCase().includes(q)) ||
          (result.fullName && result.fullName.toLowerCase().includes(q)) ||
          (result.role && result.role.toLowerCase().includes(q)) ||
          (result.phone && result.phone.toLowerCase().includes(q))
        : true;

      const countryMatch = countryFilter ? result.country === countryFilter : true;
      const validityMatch =
        validityFilter === 'all'
          ? true
          : validityFilter === 'yes'
          ? result.isValid === true
          : result.isValid === false;

      const nameTypeMatch =
        nameTypeFilter === 'all'
          ? true
          : nameTypeFilter === 'with_role'
          ? Boolean(result.role)
          : nameTypeFilter === 'personal'
          ? !result.isRoleBased && Boolean(result.firstName || result.lastName || result.fullName)
          : Boolean(result.isRoleBased);

      const phoneMatch =
        phoneFilter === 'all'
          ? true
          : Boolean(result.phone && result.phone.trim().length > 5);

      return searchMatch && countryMatch && validityMatch && nameTypeMatch && phoneMatch;
    });
  }, [results, searchFilter, countryFilter, validityFilter, nameTypeFilter, phoneFilter]);

  // Reset to page 1 whenever filters or results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, countryFilter, validityFilter, nameTypeFilter, phoneFilter, results.length]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);
  
  const areFiltersActive = searchFilter || countryFilter || validityFilter !== 'all' || nameTypeFilter !== 'all' || phoneFilter !== 'all';

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };
  
  const handleCopyAll = () => {
    if (filteredResults.length > 0) {
      const allEmails = filteredResults.map(r => r.email).join('\n');
      navigator.clipboard.writeText(allEmails);
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    }
  };

  const handleExportCSV = () => {
    const header = "Email,FirstName,LastName,FullName,Role,Phone,CompanyName,Website,Country,AccountType,MXStatus\n";
    const csvContent = filteredResults.map(r => {
      const company = r.companyName ? `"${r.companyName.replace(/"/g, '""')}"` : '';
      const fn = r.firstName ? `"${r.firstName.replace(/"/g, '""')}"` : '';
      const ln = r.lastName ? `"${r.lastName.replace(/"/g, '""')}"` : '';
      const full = r.fullName ? `"${r.fullName.replace(/"/g, '""')}"` : (r.isRoleBased ? '"Role Account"' : '');
      const role = r.role ? `"${r.role.replace(/"/g, '""')}"` : '';
      const phone = r.phone ? `"${r.phone.replace(/"/g, '""')}"` : '';
      const accType = r.isRoleBased ? '"Role / Department (info, sales)"' : '"Personal Direct"';
      const mx = r.isValid ? '"Valid MX"' : '"Invalid / No MX"';
      return [r.email, fn, ln, full, role, phone, company, r.sourceUrl, r.country || 'N/A', accType, mx].join(',');
    }).join('\n');
    downloadFile(header + csvContent, `extracted_leads_${filteredResults.length}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportExcel = () => {
    const rows = filteredResults.map(r => ({
      "Email Address": r.email,
      "First Name": r.firstName || (r.isRoleBased ? "—" : ""),
      "Last Name": r.lastName || (r.isRoleBased ? "—" : ""),
      "Full Name": r.fullName || (r.isRoleBased ? "Role Account" : ""),
      "Job Role / Title": r.role || "—",
      "Contact Phone / Tel": r.phone || "—",
      "Company Name": r.companyName || '',
      "Website / Source URL": r.sourceUrl,
      "Country / Region": r.country || 'N/A',
      "Account Type": r.isRoleBased ? "Role / Generic (Info, Sales, Orders)" : "Personal Contact",
      "MX Deliverability": r.isValid ? "Verified Active MX" : "Invalid / No MX"
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted B2B Leads");
    XLSX.writeFile(workbook, `Extracted_B2B_Leads_${filteredResults.length}.xlsx`);
  };

  const handleExportTXT = () => {
    const txtContent = filteredResults.map(r => r.email).join('\n');
    downloadFile(txtContent, `extracted_emails_${filteredResults.length}.txt`, 'text/plain;charset=utf-8;');
  };

  const handleClearFilters = () => {
    setSearchFilter('');
    setCountryFilter('');
    setValidityFilter('all');
    setNameTypeFilter('all');
    setPhoneFilter('all');
  };

  const renderContent = () => {
    if (isLoading && results.length === 0) {
      return <SkeletonLoader />;
    }
    if (error) {
      return <div className="text-center p-10 text-red-400 bg-red-900/20 rounded-lg border border-red-900/50 m-4">{error}</div>;
    }
    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <div className="bg-gray-800/50 p-6 rounded-full mb-4">
             <SparklesIcon className="h-12 w-12 text-gray-500" />
          </div>
          <h3 className="text-xl font-semibold text-white">Ready for Real-Time B2B Search</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm text-center">
            Set your target country and industry, choose Deep & Accurate mode or Fast Sprint, and watch verified leads stream line-by-line!
          </p>
        </div>
      );
    }

    if (filteredResults.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
            <MagnifyingGlassIcon className="h-12 w-12 text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-white">No Matching Results</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or clear them to see all results.</p>
            <button onClick={handleClearFilters} className="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition">
                Clear Filters
            </button>
        </div>
      );
    }

    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, filteredResults.length);

    return (
      <div className="flex flex-col h-full">
        {/* Table View with Paginated Rendering */}
        <div className="overflow-auto custom-scrollbar flex-grow">
            <table className="min-w-full text-left border-collapse table-fixed">
            <thead className="bg-gray-900/95 sticky top-0 z-10 backdrop-blur-md border-b border-gray-700 shadow-sm">
                <tr>
                <th scope="col" className="py-3 pl-5 pr-3 text-xs font-bold uppercase tracking-wider text-gray-400 w-[24%]">Email Address & Type</th>
                <th scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 w-[20%]">Contact & Role</th>
                <th scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 w-[16%]">Phone / Contact No.</th>
                <th scope="col" className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 w-[20%]">Company & Website</th>
                <th scope="col" className="px-2 py-3 text-xs font-bold uppercase tracking-wider text-gray-400 w-[9%]">Country</th>
                <th scope="col" className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 w-[7%]">MX DNS</th>
                <th scope="col" className="py-3 pr-5 text-right text-xs font-bold uppercase tracking-wider text-gray-400 w-[4%]">Act</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 bg-transparent">
                {paginatedResults.map((item, index) => {
                  const contactName = item.fullName || (item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : '');
                  return (
                    <tr 
                      key={`${item.email}-${index}`} 
                      className={`hover:bg-gray-700/40 odd:bg-gray-800/20 transition-all duration-200 group ${
                        item.isNew ? 'border-l-2 border-l-emerald-400 bg-emerald-950/20' : ''
                      }`}
                    >
                        {/* 1. Email Address & Type */}
                        <td className="py-3 pl-5 pr-3 align-top truncate">
                            <div className="flex flex-col">
                                <span className="font-mono text-xs sm:text-sm text-blue-300 font-semibold selection:bg-blue-500/30 truncate" title={item.email}>
                                  {item.email}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {item.isRoleBased ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded" title="Generic department / role address (info, sales, order, etc.)">
                                            <Building2 className="w-2.5 h-2.5" />
                                            Role / Dept
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded" title="Personal named mailbox">
                                            <User className="w-2.5 h-2.5" />
                                            Personal Direct
                                        </span>
                                    )}
                                    {item.searchEngine && (
                                      <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded bg-gray-800 text-gray-400 border border-gray-700 font-mono">
                                        {item.searchEngine}
                                      </span>
                                    )}
                                </div>
                            </div>
                        </td>

                        {/* 2. Contact Person & Role */}
                        <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-1">
                                {contactName ? (
                                  <span className="text-xs font-bold text-gray-100 flex items-center gap-1">
                                    <User className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span className="truncate">{contactName}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-gray-500 italic">
                                    {item.isRoleBased ? 'Commercial Department' : '—'}
                                  </span>
                                )}

                                {item.role ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-700/60 px-2 py-0.5 rounded-full w-fit max-w-full truncate" title={item.role}>
                                    <Briefcase className="w-2.5 h-2.5 shrink-0 text-indigo-400" />
                                    <span className="truncate">{item.role}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-500">— No Role Stated</span>
                                )}
                            </div>
                        </td>

                        {/* 3. Phone / Contact Number */}
                        <td className="px-3 py-3 align-top">
                            {item.phone && item.phone.trim().length > 5 ? (
                              <div className="flex items-center gap-1.5">
                                <a 
                                  href={`tel:${item.phone.replace(/\s+/g, '')}`}
                                  className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/50 border border-emerald-800/60 px-2 py-1 rounded transition max-w-[130px] truncate"
                                  title={`Call: ${item.phone}`}
                                >
                                  <Phone className="w-3 h-3 shrink-0 text-emerald-400" />
                                  <span className="truncate">{item.phone}</span>
                                </a>
                                <CopyButton textToCopy={item.phone} title="Copy phone number" />
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                        </td>

                        {/* 4. Company Name & Website */}
                        <td className="px-3 py-3 align-top">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-200 mb-0.5 truncate" title={item.companyName}>
                                  {item.companyName || 'Corporate Lead'}
                                </span>
                                <a 
                                    href={item.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-[11px] text-gray-400 group-hover:text-blue-400 transition-colors flex items-center gap-1 truncate max-w-full"
                                    title={item.sourceUrl}
                                >
                                    <LinkIcon className="w-3 h-3 shrink-0 text-gray-500" />
                                    <span className="truncate">{item.sourceUrl.replace(/^https?:\/\//, '')}</span>
                                </a>
                            </div>
                        </td>

                        {/* 5. Country */}
                        <td className="px-2 py-3 text-xs text-gray-300 align-top truncate font-medium">
                            {item.country && item.country !== 'N/A' ? (
                                <span className="inline-flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                                    <span className="truncate">{item.country}</span>
                                </span>
                            ) : (
                                <span className="text-gray-500">—</span>
                            )}
                        </td>

                        {/* 6. MX Deliverability Status */}
                        <td className="px-2 py-3 text-center align-top">
                            {item.isValid !== false ? (
                                <span className="inline-flex items-center gap-1 rounded bg-green-900/40 px-2 py-0.5 text-[10px] font-bold text-green-300 ring-1 ring-inset ring-green-500/30" title="Active MX record verified on DNS">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-green-400" />
                                  Active MX
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-300 ring-1 ring-inset ring-red-500/30" title="No active MX records found">
                                  <ShieldAlert className="w-2.5 h-2.5 text-red-400" />
                                  No MX
                                </span>
                            )}
                        </td>

                        {/* 7. Action */}
                        <td className="py-3 pr-5 text-right align-top">
                            <div className="flex items-center justify-end gap-1">
                                <CopyButton textToCopy={item.email} title="Copy email address" />
                                {onSendToEmailSender && (
                                    <button
                                        onClick={() => onSendToEmailSender([item])}
                                        className="p-1.5 rounded-md bg-blue-900/40 hover:bg-blue-600 text-blue-300 hover:text-white transition-all duration-200"
                                        title="Send to Email Sender"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                  );
                })}
            </tbody>
            </table>
        </div>

        {/* High-Performance Pagination Footer */}
        <div className="px-5 py-3 bg-gray-900/90 border-t border-gray-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-gray-200">{startIndex}</strong> to <strong className="text-gray-200">{endIndex}</strong> of <strong className="text-blue-400 font-mono">{filteredResults.length.toLocaleString()}</strong> leads
            </span>
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-0.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
            {phoneCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-emerald-950/60 text-emerald-300 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                📞 {phoneCount.toLocaleString()} Phones
              </span>
            )}
            {roleCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-indigo-950/60 text-indigo-300 border border-indigo-700/40 px-2 py-0.5 rounded-full">
                👑 {roleCount.toLocaleString()} Roles/Titles
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded border border-gray-700 text-gray-300 transition-colors"
                title="First Page"
              >
                &laquo;
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded border border-gray-700 text-gray-300 transition-colors"
                title="Previous Page"
              >
                &lsaquo;
              </button>

              <span className="px-3 py-1 font-mono text-gray-300 bg-gray-800/80 rounded border border-gray-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded border border-gray-700 text-gray-300 transition-colors"
                title="Next Page"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded border border-gray-700 text-gray-300 transition-colors"
                title="Last Page"
              >
                &raquo;
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl flex flex-col h-[85vh]">
      <div className="p-5 border-b border-gray-700/50 bg-gray-800/30 shrink-0">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Results 
                  <span className="text-sm font-normal text-gray-400 bg-gray-700/50 px-2.5 py-0.5 rounded-full font-mono">
                      {results.length > 0 ? `${filteredResults.length.toLocaleString()} leads`: '0'}
                  </span>
              </h2>
              {results.length > 0 && (
                <span className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  {uniqueCompaniesCount.toLocaleString()} Unique {uniqueCompaniesCount === 1 ? 'Company' : 'Companies'}
                </span>
              )}
              {phoneCount > 0 && (
                <span className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  📞 {phoneCount.toLocaleString()} Phones
                </span>
              )}
              {roleCount > 0 && (
                <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-700/50 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  👑 {roleCount.toLocaleString()} Roles
                </span>
              )}
              {avoidDuplicateCompanies && (
                <span className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 px-2.5 py-0.5 rounded-full font-medium" title="Company duplicate checker active">
                  ✓ Deduplication Active
                </span>
              )}
            </div>
            {isLoading && progressMessage && (
              <p className="text-xs text-blue-300 mt-1 animate-pulse font-medium">{progressMessage}</p>
            )}
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {onSendToValidator && (
                <button 
                  onClick={onSendToValidator} 
                  className="flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-orange-600/30 hover:bg-orange-600 text-orange-200 hover:text-white transition-all duration-200 border border-orange-500/50 shadow-sm"
                  title="Transfer all extracted emails directly to Sorter & Validator for MX verification"
                >
                  <ShieldCheckIcon className="w-4 h-4 mr-1.5 text-orange-400" />
                  Validate & Sort ({filteredResults.length.toLocaleString()})
                </button>
              )}
              {onSendToEmailSender && (
                <button 
                  onClick={() => {
                    const cleanLeads = filteredResults.filter(r => r.isValid !== false);
                    onSendToEmailSender(cleanLeads);
                  }} 
                  className="flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-all duration-200 border border-blue-400/50 shadow-md shadow-blue-600/20"
                  title="Dispatch personalized emails one-by-one with high inbox deliverability"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send Clean Leads ({filteredResults.filter(r => r.isValid !== false).length.toLocaleString()})
                </button>
              )}
              {onDeepCrawlCompanyWebsites && (
                <button 
                  onClick={onDeepCrawlCompanyWebsites} 
                  disabled={filteredResults.length === 0 || isDeepCrawling}
                  className="flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-purple-600/30 hover:bg-purple-600/60 text-purple-200 hover:text-white transition-all duration-200 border border-purple-500/50 shadow-sm disabled:opacity-50"
                  title="Spiders live website contact & impressum pages to extract emails, phone numbers, and executive roles"
                >
                  <Globe className={`w-3.5 h-3.5 mr-1.5 ${isDeepCrawling ? 'animate-spin text-purple-400' : 'text-purple-300'}`} />
                  {isDeepCrawling ? 'Spidering Contact Pages...' : '⚡ Deep Crawl Subpages'}
                </button>
              )}
              {onDeduplicateCompanies && (
                <button 
                  onClick={onDeduplicateCompanies} 
                  className="flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 hover:text-white transition-all duration-200 border border-amber-600/40"
                  title="Remove duplicate company records, keeping 1 primary contact email per company"
                >
                  ⚡ Deduplicate
                </button>
              )}
              <button onClick={handleCopyAll} disabled={filteredResults.length === 0} className="flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-all duration-200 disabled:opacity-50 border border-gray-600">
                {allCopied ? <><CheckIcon className="w-4 h-4 mr-1.5 text-green-400" />Copied</> : <><ClipboardIcon className="w-4 h-4 mr-1.5" />Copy All</>}
              </button>
              <div className="h-6 w-px bg-gray-700 mx-1"></div>
              <button onClick={handleExportTXT} disabled={filteredResults.length === 0} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-blue-600/80 hover:bg-blue-600 text-white transition-all duration-200 disabled:opacity-50" title="Export as TXT text list">TXT</button>
              <button onClick={handleExportCSV} disabled={filteredResults.length === 0} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-teal-600/80 hover:bg-teal-600 text-white transition-all duration-200 disabled:opacity-50" title="Export as CSV spreadsheet">CSV</button>
              <button onClick={handleExportExcel} disabled={filteredResults.length === 0} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-green-600/80 hover:bg-green-600 text-white transition-all duration-200 disabled:opacity-50" title="Export as Microsoft Excel (.xlsx)">XLSX</button>
              <div className="h-6 w-px bg-gray-700 mx-1"></div>
              <button onClick={onClearResults} className="flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md bg-red-600/20 hover:bg-red-600/40 text-red-200 hover:text-white transition-all duration-200 border border-red-900/30">
                <XCircleIcon className="w-4 h-4 mr-1.5" /> Clear
              </button>
            </div>
          )}
        </div>
        
        {results.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <div className="relative group">
                    <MagnifyingGlassIcon className="pointer-events-none w-4 h-4 absolute top-1/2 transform -translate-y-1/2 left-3 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search emails, roles, phones, companies..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="pl-9 pr-4 py-1.5 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition text-sm w-72 placeholder-gray-500 text-gray-200"
                    />
                </div>

                <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    disabled={countriesWithCounts.length === 0}
                    className="px-3 py-1.5 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition text-sm disabled:opacity-50 text-gray-300"
                >
                    <option value="">All Countries</option>
                    {countriesWithCounts.map(({ name, count }) => (
                        <option key={name} value={name}>{name} ({count})</option>
                    ))}
                </select>

                <select
                    value={nameTypeFilter}
                    onChange={(e) => setNameTypeFilter(e.target.value as any)}
                    className="px-3 py-1.5 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition text-sm text-gray-300"
                >
                    <option value="all">All Roles & Types</option>
                    <option value="with_role">👑 With Role/Job Title</option>
                    <option value="personal">👤 Personal Names Only</option>
                    <option value="role">🏢 Role/Generic Accounts</option>
                </select>

                <select
                    value={phoneFilter}
                    onChange={(e) => setPhoneFilter(e.target.value as any)}
                    className="px-3 py-1.5 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition text-sm text-gray-300"
                >
                    <option value="all">All Phone Status</option>
                    <option value="with_phone">📞 Has Phone Number</option>
                </select>
                
                <select
                    value={validityFilter}
                    onChange={(e) => setValidityFilter(e.target.value)}
                    className="px-3 py-1.5 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition text-sm text-gray-300"
                >
                    <option value="all">All MX Status</option>
                    <option value="yes">✓ Valid MX Only</option>
                    <option value="no">✗ Invalid MX Only</option>
                </select>
                
                {areFiltersActive && (
                    <button onClick={handleClearFilters} className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 transition-all duration-200">
                        Reset Filters
                    </button>
                )}
            </div>
        )}
      </div>
      
      <div className="flex-grow overflow-hidden relative bg-gray-900/20">
        {renderContent()}
      </div>
    </div>
  );
};

export default ResultsDisplay;
