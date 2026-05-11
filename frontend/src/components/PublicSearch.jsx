import React, { useEffect, useState } from 'react';
import api from '../utils/axios';

const PAGE_SIZE = 10;
const DOCUMENT_TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'TEG', label: 'TEG' },
  { value: 'INF PASANTIA', label: 'INF PASANTIA' },
];

const PublicSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [visibleResults, setVisibleResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageMode, setPageMode] = useState('default');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [periodoAcademico, setPeriodoAcademico] = useState('');
  const [periodos, setPeriodos] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    loadPeriodos();
    loadDefaultDocuments(1);
  }, [tipoDocumento, periodoAcademico]);

  useEffect(() => {
    if (pageMode === 'search') {
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      setVisibleResults(results.slice(startIndex, startIndex + PAGE_SIZE));
      setHasNextPage(results.length > currentPage * PAGE_SIZE);
    }
  }, [currentPage, results, pageMode]);

  const loadPeriodos = async () => {
    try {
      const response = await api.get('/documents/periodos');
      setPeriodos(response.data?.periodos || []);
    } catch (err) {
      console.error('Periodos load error:', err);
    }
  };

  const loadDefaultDocuments = async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const offset = (page - 1) * PAGE_SIZE;
      const params = {
        offset,
        limit: PAGE_SIZE + 1,
      };

      if (tipoDocumento) {
        params.tipo_documento = tipoDocumento;
      }
      if (periodoAcademico) {
        params.periodo_academico = periodoAcademico;
      }

      const response = await api.get('/documents', { params });

      const documents = response.data || [];
      const pageData = documents.slice(0, PAGE_SIZE);
      setResults(pageData);
      setVisibleResults(pageData);
      setPageMode('default');
      setHasNextPage(documents.length > PAGE_SIZE);
      setCurrentPage(page);
    } catch (err) {
      console.error('Default documents error:', err);
      setError('No se pudieron cargar documentos. Intenta refrescar.');
      setResults([]);
      setVisibleResults([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Ingresa un término de búsqueda.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const body = {
        consulta: trimmedQuery,
        limit: 100,
      };

      if (tipoDocumento) {
        body.tipo_documento = tipoDocumento;
      }
      if (periodoAcademico) {
        body.periodo_academico = periodoAcademico;
      }

      const response = await api.post('/search/semantic', body);
      const searchResults = response.data?.resultados || [];
      setResults(searchResults);
      setCurrentPage(1);
      setPageMode('search');
      setHasNextPage(searchResults.length > PAGE_SIZE);
      setVisibleResults(searchResults.slice(0, PAGE_SIZE));
    } catch (err) {
      console.error('Search error:', err);
      setError('No se pudo obtener resultados. Intenta de nuevo.');
      setResults([]);
      setVisibleResults([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setQuery('');
    setTipoDocumento('');
    setPeriodoAcademico('');
    loadDefaultDocuments(1);
  };

  const handleApplyFilters = () => {
    setQuery('');
    loadDefaultDocuments(1);
  };

  const goPrevious = () => {
    if (currentPage === 1) return;
    if (pageMode === 'default') {
      loadDefaultDocuments(currentPage - 1);
    } else {
      setCurrentPage((prev) => Math.max(prev - 1, 1));
    }
  };

  const goNext = () => {
    if (!hasNextPage) return;
    if (pageMode === 'default') {
      loadDefaultDocuments(currentPage + 1);
    } else {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const totalPages = pageMode === 'search' ? Math.max(1, Math.ceil(results.length / PAGE_SIZE)) : null;

  return (
    <section className="min-h-screen bg-dark-bg text-text-main py-10 overflow-x-hidden max-w-full">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 rounded-3xl border border-dark-border bg-dark-card p-8 shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-3">Búsqueda de tesis UGMA</h1>
              <p className="text-text-main/80 max-w-2xl">
                Los filtros se aplican automáticamente a la lista de documentos. Usa la búsqueda semántica para ver coincidencias.
              </p>
            </div>
            <div className="text-sm text-text-main/70">
              {loading ? 'Cargando...' : `Página ${currentPage}${totalPages ? ` de ${totalPages}` : ''}`}
            </div>
          </div>

          <form className="mt-8 flex flex-col gap-4 lg:grid lg:grid-cols-[2.5fr_1.2fr_1.2fr_auto]" onSubmit={handleSearch}>
            <div className="relative w-full">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Buscar tesis por tema..."
                className="w-full rounded-2xl border border-dark-border bg-dark-bg pl-12 pr-5 py-4 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:contents">
              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-4 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
              >
                {DOCUMENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value} className="bg-dark-bg text-text-main">
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={periodoAcademico}
                onChange={(e) => setPeriodoAcademico(e.target.value)}
                className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-4 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
              >
                <option value="">Todos los periodos</option>
                {periodos.map((periodo) => (
                  <option key={periodo} value={periodo} className="bg-dark-bg text-text-main">
                    {periodo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 lg:flex-none inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-dark-bg font-bold shadow-lg shadow-primary/20 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 min-w-[120px]"
              >
                {loading ? '...' : 'Buscar'}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                title="Limpiar filtros"
                className="inline-flex items-center justify-center rounded-2xl border border-dark-border bg-dark-bg px-5 py-4 text-text-main transition hover:border-primary hover:text-primary active:scale-95 disabled:opacity-50"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </form>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>

        <div className="grid gap-6 w-full max-w-full overflow-hidden">
          {visibleResults.length > 0 ? (
            visibleResults.map((item, index) => (
              <article
                key={`${item.titulo}-${index}`}
                className="rounded-3xl border border-dark-border bg-dark-card p-6 shadow-lg overflow-hidden w-full"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between w-full">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-semibold text-text-main leading-tight line-clamp-2 overflow-hidden" title={item.titulo}>
                      {item.titulo}
                    </h2>
                    <p className="mt-2 text-sm text-text-main/80 truncate">
                      {item.autores?.join(', ') || 'Autor desconocido'}
                    </p>
                    <p className="mt-1 text-sm text-text-main/70">
                      Tutor: {item.tutor || 'N/A'} · {item.periodo_academico || 'Periodo no disponible'}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    {pageMode === 'search' && (
                      <span className="rounded-full border border-dark-border bg-black/20 px-3 py-1 text-sm text-text-main/80">
                        {Math.round((item.score ?? 0) * 100)}%
                      </span>
                    )}
                    <a
                      href={item.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-2xl bg-primary px-5 py-2 text-sm font-bold text-dark-bg transition hover:scale-105 active:scale-95"
                    >
                      Ver Tesis
                    </a>
                  </div>
                </div>

                <p className="mt-5 text-text-main/80 line-clamp-3 whitespace-pre-line">
                  {item.resumen || 'Sin resumen disponible.'}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dark-border bg-dark-card p-10 text-center text-text-main/70">
              {loading ? 'Cargando resultados...' : 'No se encontraron tesis para mostrar.'}
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 rounded-3xl border border-dark-border bg-dark-card px-6 py-5 text-text-main">
          <button
            type="button"
            onClick={goPrevious}
            disabled={currentPage === 1}
            className="rounded-2xl border border-dark-border bg-black/20 px-4 py-2 text-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-text-main/80">
            Página {currentPage}
            {totalPages ? ` de ${totalPages}` : ''}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={!hasNextPage}
            className="rounded-2xl border border-dark-border bg-black/20 px-4 py-2 text-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
};

export default PublicSearch;
