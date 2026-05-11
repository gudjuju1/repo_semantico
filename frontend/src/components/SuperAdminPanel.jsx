import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/axios';

const TABS = ['Documentos', 'Usuarios', 'Auditoría (Logs)'];
const DOCUMENT_TYPES = ['', 'TEG', 'INF PASANTIA'];
const ITEMS_PER_PAGE = 10;

const emptyDocumentForm = {
  titulo: '',
  autores: '',
  tutor: '',
  tipo_documento: 'TEG',
  periodo_academico: '',
  resumen: '',
  file: null,
};

const emptyUserForm = {
  nombre: '',
  correo: '',
  password: '',
  llave_seguridad: '',
};

const parseErrorDetail = (err, defaultMsg) => {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const field = d.loc && d.loc.length > 0 ? d.loc[d.loc.length - 1] : 'Un campo';
      
      if (d.type === 'value_error.email' || (d.msg && d.msg.toLowerCase().includes('email'))) {
        return 'Por favor, ingresa un correo electrónico válido.';
      }
      if (d.type === 'value_error.missing' || d.type === 'missing') {
        return `El campo "${field}" es obligatorio.`;
      }
      if (d.type === 'string_too_short') {
        return `El campo "${field}" es demasiado corto.`;
      }
      
      return `Revisa el campo "${field}", parece tener un formato incorrecto.`;
    }).join(' | ');
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return defaultMsg;
};

const formatAction = (action) => {
  const mapping = {
    'registro': 'REGISTRO DE DOCUMENTO',
    'edición': 'EDICION DE DOCUMENTO',
    'eliminación': 'ELIMINACION DE DOCUMENTO',
    'CREAR_USUARIO': 'REGISTRO DE USUARIO',
    'EDITAR_USUARIO': 'EDICION DE USUARIO',
    'ELIMINAR_USUARIO': 'ELIMINACION DE USUARIO'
  };
  return mapping[action] || (action || '').toUpperCase();
};

const SuperAdminPanel = () => {
  const [activeTab, setActiveTab] = useState('Documentos');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [periodos, setPeriodos] = useState([]);

  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formState, setFormState] = useState(emptyDocumentForm);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isUserEditMode, setIsUserEditMode] = useState(false);
  const [userFormState, setUserFormState] = useState(emptyUserForm);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [controlKey, setControlKey] = useState('');
  const [isControlKeyModalOpen, setIsControlKeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [processingControlKey, setProcessingControlKey] = useState(false);

  useEffect(() => {
    loadDocuments();
    loadUsers();
    loadLogs();
    loadPeriodos();
  }, []);

  useEffect(() => {
    if (activeTab === 'Usuarios' && users.length === 0) {
      loadUsers();
    } else if (activeTab === 'Auditoría (Logs)' && logs.length === 0) {
      loadLogs();
    }
  }, [activeTab, users.length, logs.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchText, filterType, filterPeriod]);

  const requestControlKey = (action) => {
    setPendingAction(() => action);
    setIsControlKeyModalOpen(true);
  };

  const handleControlKeySubmit = async (event) => {
    event.preventDefault();
    if (processingControlKey || !pendingAction) return;

    setProcessingControlKey(true);
    try {
      await pendingAction(controlKey);
      setPendingAction(null);
      setControlKey('');
      setIsControlKeyModalOpen(false);
    } catch (error) {
      console.error('Control key action failed:', error);
      // No cerramos el modal en caso de error para que el usuario pueda intentar de nuevo
    } finally {
      setProcessingControlKey(false);
    }
  };

  const loadDocuments = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.get('/documents', {
        params: {
          limit: 1000,
        },
      });
      setDocuments(response.data || []);
    } catch (err) {
      console.error('loadDocuments error', err);
      setError('No se pudieron cargar los documentos.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (err) {
      console.error('loadUsers error', err);
      setError('No se pudo cargar la lista de usuarios.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await api.get('/documents/audit-logs');
      setLogs(response.data || []);
    } catch (err) {
      console.error('loadLogs error', err);
      setError('No se pudieron cargar los logs de auditoría.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPeriodos = async () => {
    try {
      const response = await api.get('/documents/periodos');
      setPeriodos(response.data?.periodos || []);
    } catch (err) {
      console.error('loadPeriodos error', err);
    }
  };

  const filteredDocuments = useMemo(() => {
    const lowerText = searchText.toLowerCase().trim();
    return documents.filter((doc) => {
      const title = (doc.titulo || '').toLowerCase();
      const authors = (doc.autores || []).join(', ').toLowerCase();
      const matchesText = !lowerText || title.includes(lowerText) || authors.includes(lowerText);
      const matchesType = !filterType || doc.tipo_documento === filterType;
      const matchesPeriod = !filterPeriod || doc.periodo_academico === filterPeriod;
      return matchesText && matchesType && matchesPeriod;
    });
  }, [documents, filterPeriod, filterType, searchText]);

  const openAddModal = () => {
    setFormState(emptyDocumentForm);
    setSelectedDocument(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (doc) => {
    setSelectedDocument(doc);
    setFormState({
      titulo: doc.titulo || '',
      autores: (doc.autores || []).join(', '),
      tutor: doc.tutor || '',
      tipo_documento: doc.tipo_documento || 'TEG',
      periodo_academico: doc.periodo_academico || '',
      resumen: doc.resumen || '',
      file: null,
    });
    setIsEditModalOpen(true);
  };

  const closeModals = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setFormState(emptyDocumentForm);
    setSelectedDocument(null);
  };

  const handleFormChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddSubmit = async (event, controlKey) => {
    event.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('titulo', formState.titulo);
      formData.append('autores', formState.autores);
      formData.append('tutor', formState.tutor);
      formData.append('tipo_documento', formState.tipo_documento);
      formData.append('periodo_academico', formState.periodo_academico);
      formData.append('resumen', formState.resumen);
      if (formState.file) {
        formData.append('file', formState.file);
      }

      await api.post('/documents/upload', formData, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      closeModals();
      loadDocuments();
    } catch (err) {
      console.error('add document error', err);
      setError('No se pudo agregar el documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddClick = (event) => {
    event.preventDefault();
    requestControlKey((controlKey) => handleAddSubmit(event, controlKey));
  };

  const handleEditSubmit = async (event, controlKey) => {
    event.preventDefault();
    if (!selectedDocument) return;
    setSaving(true);
    try {
      const updatedForm = new FormData();
      updatedForm.append('titulo', formState.titulo);
      updatedForm.append('autores', formState.autores);
      updatedForm.append('tutor', formState.tutor);
      updatedForm.append('tipo_documento', formState.tipo_documento);
      updatedForm.append('periodo_academico', formState.periodo_academico);
      updatedForm.append('resumen', formState.resumen);
      if (formState.file) {
        updatedForm.append('file', formState.file);
      }

      await api.put(`/documents/${selectedDocument.id}`, updatedForm, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      closeModals();
      loadDocuments();
    } catch (err) {
      console.error('edit document error', err);
      setError('No se pudo actualizar el documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (event) => {
    event.preventDefault();
    requestControlKey((controlKey) => handleEditSubmit(event, controlKey));
  };

  const handleDeleteDocument = async (doc, controlKey) => {
    setLoading(true);
    try {
      await api.delete(`/documents/${doc.id}`, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      loadDocuments();
    } catch (err) {
      console.error('delete document error', err);
      setError('No se pudo eliminar el documento.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (doc) => {
    if (!window.confirm(`¿Eliminar documento "${doc.titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    requestControlKey((controlKey) => handleDeleteDocument(doc, controlKey));
  };

  const handleUserFormChange = (field, value) => {
    setUserFormState((prev) => ({ ...prev, [field]: value }));
  };

  const openEditUserModal = (user) => {
    setSelectedUser(user);
    setUserFormState({
      nombre: user.nombre || user.name || '',
      correo: user.correo || user.email || '',
      password: '',
      llave_seguridad: '',
    });
    setIsUserEditMode(true);
    setIsUserModalOpen(true);
  };

  const closeUserModal = () => {
    setIsUserModalOpen(false);
    setSelectedUser(null);
    setUserFormState(emptyUserForm);
    setIsUserEditMode(false);
  };

  const handleCreateUserSubmit = async (controlKey) => {
    setSaving(true);
    try {
      await api.post(
        '/users',
        {
          nombre: userFormState.nombre,
          correo: userFormState.correo,
          password: userFormState.password,
          llave_seguridad: userFormState.llave_seguridad,
        },
        {
          headers: {
            'x-control-key': controlKey,
          },
        }
      );
      closeUserModal();
      loadUsers();
    } catch (err) {
      console.error('create user error', err);
      setError(parseErrorDetail(err, 'No se pudo crear el usuario.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUserClick = (event) => {
    event.preventDefault();
    requestControlKey((controlKey) => handleCreateUserSubmit(controlKey));
  };

  const handleUpdateUserSubmit = async (controlKey) => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const payload = {
        nombre: userFormState.nombre,
        correo: userFormState.correo,
      };

      if (userFormState.password) {
        payload.password = userFormState.password;
      }
      if (userFormState.llave_seguridad) {
        payload.llave_seguridad = userFormState.llave_seguridad;
      }

      await api.patch(`/users/${selectedUser.id}`, payload, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      closeUserModal();
      loadUsers();
    } catch (err) {
      console.error('update user error', err);
      setError(parseErrorDetail(err, 'No se pudo actualizar el usuario.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUserClick = (event) => {
    event.preventDefault();
    requestControlKey((controlKey) => handleUpdateUserSubmit(controlKey));
  };

  const handleDeleteUser = async (user, controlKey) => {
    setLoading(true);
    try {
      await api.delete(`/users/${user.id}`, {
        headers: {
          'x-control-key': controlKey,
        },
      });
      loadUsers();
    } catch (err) {
      console.error('delete user error', err);
      setError(parseErrorDetail(err, 'No se pudo eliminar el usuario.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUserClick = (user) => {
    if (!window.confirm(`¿Eliminar usuario "${user.correo || user.email}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    requestControlKey((controlKey) => handleDeleteUser(user, controlKey));
  };

  const activeClass = (tab) =>
    tab === activeTab
      ? 'bg-primary text-dark-bg font-semibold'
      : 'text-text-main hover:text-primary';

  const totalDocumentPages = Math.ceil(filteredDocuments.length / ITEMS_PER_PAGE);
  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalUserPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalLogPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
  const paginatedLogs = logs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const renderPagination = (totalPages) => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-4">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="rounded-2xl border border-dark-border bg-black/10 px-4 py-2 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-text-main">
          Página <span className="font-bold text-primary">{currentPage}</span> de {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="rounded-2xl border border-dark-border bg-black/10 px-4 py-2 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-main">
      <div className="mx-auto flex flex-col lg:flex-row min-h-screen max-w-[1600px] gap-6 px-4 py-6 lg:px-8">
        
        {/* Sidebar / Mobile Nav */}
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-3xl border border-dark-border bg-dark-card p-6 shadow-lg">
              <div className="mb-6 border-b border-dark-border pb-4">
                <h2 className="text-xl font-black text-primary tracking-tight">SUPERADMIN</h2>
                <p className="mt-1 text-xs text-text-main/50 uppercase font-bold tracking-widest">Panel de Control</p>
              </div>
              
              <nav className="flex flex-col gap-2">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`text-left rounded-2xl px-5 py-3 text-sm font-bold transition-all duration-200 ${activeClass(tab)}`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>

              <div className="mt-6 hidden lg:block rounded-2xl border border-dark-border bg-black/20 p-4 text-xs space-y-3">
                <p className="font-bold text-text-main/40 uppercase tracking-widest">Estadísticas Rápidas</p>
                <div className="flex justify-between">
                  <span className="text-text-main/60">Tesis:</span>
                  <span className="font-bold text-primary">{documents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-main/60">Usuarios:</span>
                  <span className="font-bold text-primary">{users.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-main/60">Logs:</span>
                  <span className="font-bold text-primary">{logs.length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 space-y-6">
          <section className="rounded-3xl border border-dark-border bg-dark-card p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-text-main">{activeTab}</h1>
                <p className="text-text-main/70">
                  {activeTab === 'Documentos' && 'Gestiona el repositorio de tesis y control de documentos.'}
                  {activeTab === 'Usuarios' && 'Revisa y administra los usuarios del sistema.'}
                  {activeTab === 'Auditoría (Logs)' && 'Consulta las acciones recientes del sistema.'}
                </p>
              </div>
              {activeTab === 'Documentos' && (
                <button
                  type="button"
                  onClick={openAddModal}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90"
                >
                  Agregar Documento
                </button>
              )}
              {activeTab === 'Usuarios' && (
                <button
                  type="button"
                  onClick={() => {
                    setUserFormState(emptyUserForm);
                    setSelectedUser(null);
                    setIsUserEditMode(false);
                    setIsUserModalOpen(true);
                  }}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90"
                >
                  Agregar Admin
                </button>
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
          )}

          {activeTab === 'Documentos' && (
            <section className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar documentos"
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todos los tipos</option>
                  {DOCUMENT_TYPES.filter((type) => type).map((type) => (
                    <option key={type} value={type} className="bg-dark-bg text-text-main">
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Todos los periodos</option>
                  {periodos.map((periodo) => (
                    <option key={periodo} value={periodo} className="bg-dark-bg text-text-main">
                      {periodo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-dark-border bg-dark-card shadow-lg">
                <table className="min-w-full divide-y divide-dark-border text-left text-sm text-text-main">
                  <thead className="bg-dark-bg/70 text-text-main/80">
                    <tr>
                      <th className="px-4 py-3">Título</th>
                      <th className="px-4 py-3">Autores</th>
                      <th className="px-4 py-3">Tutor</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Periodo</th>
                      <th className="px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-text-main/70">
                          Cargando documentos...
                        </td>
                      </tr>
                    ) : filteredDocuments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-text-main/70">
                          No se encontraron documentos.
                        </td>
                      </tr>
                    ) : (
                      paginatedDocuments.map((doc) => (
                        <tr key={doc.id} className="hover:bg-white/5">
                          <td className="px-4 py-3 font-medium text-text-main">{doc.titulo}</td>
                          <td className="px-4 py-3 text-text-main/80">{(doc.autores || []).join(', ')}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.tutor || '-'}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.tipo_documento || '-'}</td>
                          <td className="px-4 py-3 text-text-main/80">{doc.periodo_academico || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={doc.archivo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-2xl border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
                              >
                                Ver archivo
                              </a>
                              <button
                                type="button"
                                onClick={() => openEditModal(doc)}
                                className="rounded-2xl border border-dark-border bg-black/10 px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"
                              >
                                Modificar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(doc)}
                                className="rounded-2xl border border-red-500 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {renderPagination(totalDocumentPages)}
            </section>
          )}

          {activeTab === 'Usuarios' && (
            <section className="overflow-x-auto rounded-3xl border border-dark-border bg-dark-card p-4 shadow-lg">
              <table className="min-w-full divide-y divide-dark-border text-left text-sm text-text-main">
                <thead className="bg-dark-bg/70 text-text-main/80">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-text-main/70">
                        Cargando usuarios...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-text-main/70">
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr key={user.id || user._id || user.correo} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-text-main">{user.nombre || user.name || '-'}</td>
                        <td className="px-4 py-3 text-text-main/80">{user.correo || user.email || '-'}</td>
                        <td className="px-4 py-3 text-text-main/80">{user.rol || user.role || '-'}</td>
                        <td className="px-4 py-3 space-x-2">
                          {user.rol !== 'super_admin' && user.role !== 'super_admin' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditUserModal(user)}
                                className="rounded-2xl border border-dark-border bg-black/10 px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"
                              >
                                Modificar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUserClick(user)}
                                className="rounded-2xl border border-red-500 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination(totalUserPages)}
            </section>
          )}

          {activeTab === 'Auditoría (Logs)' && (
            <section className="overflow-x-auto rounded-3xl border border-dark-border bg-dark-card p-4 shadow-lg">
              <table className="min-w-full divide-y divide-dark-border text-left text-sm text-text-main">
                <thead className="bg-dark-bg/70 text-text-main/80">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-text-main/70">
                        Cargando logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-text-main/70">
                        No se encontraron registros de auditoría.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log.id || log._id || `${log.usuario}-${log.fecha}` } className="hover:bg-white/5">
                        <td className="px-4 py-3 text-text-main">
                          {new Date(log.fecha.includes('Z') || log.fecha.match(/[-+]\d{2}:\d{2}$/) ? log.fecha : log.fecha + 'Z').toLocaleString('es-VE', { 
                            timeZone: 'America/Caracas',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-text-main/80">{log.usuario}</td>
                        <td className="px-4 py-3 text-text-main/80 font-bold">{formatAction(log.accion)}</td>
                        <td className="px-4 py-3 text-text-main/80">{log.detalles}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination(totalLogPages)}
            </section>
          )}
        </main>
      </div>

      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl custom-scrollbar">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-text-main">
                  {isEditModalOpen ? 'Modificar Documento' : 'Agregar Documento'}
                </h2>
                <p className="text-text-main/70">
                  {isEditModalOpen
                    ? 'Actualiza los datos del documento.'
                    : 'Carga una nueva tesis al repositorio.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="rounded-full border border-dark-border bg-black/20 px-3 py-2 text-text-main transition hover:border-primary hover:text-primary"
              >
                X
              </button>
            </div>

            <form onSubmit={isEditModalOpen ? handleEditClick : handleAddClick} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-text-main">
                  <span>Título</span>
                  <input
                    value={formState.titulo}
                    onChange={(e) => handleFormChange('titulo', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm text-text-main">
                  <span>Autores</span>
                  <input
                    value={formState.autores}
                    onChange={(e) => handleFormChange('autores', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    placeholder="Autor A, Autor B"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-2 text-sm text-text-main">
                  <span>Tutor</span>
                  <input
                    value={formState.tutor}
                    onChange={(e) => handleFormChange('tutor', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm text-text-main">
                  <span>Tipo de documento</span>
                  <select
                    value={formState.tipo_documento}
                    onChange={(e) => handleFormChange('tipo_documento', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="TEG">TEG</option>
                    <option value="INF PASANTIA">INF PASANTIA</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm text-text-main">
                  <span>Periodo académico</span>
                  <input
                    value={formState.periodo_academico}
                    onChange={(e) => handleFormChange('periodo_academico', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm text-text-main">
                <span>Resumen</span>
                <textarea
                  value={formState.resumen}
                  onChange={(e) => handleFormChange('resumen', e.target.value)}
                  className="min-h-30 w-full resize-none rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                  required
                />
              </label>

              <label className="space-y-2 text-sm text-text-main">
                <span>Seleccionar archivo:</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleFormChange('file', e.target.files?.[0] || null)}
                  className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 file:hidden"
                  {...(!isEditModalOpen ? { required: true } : {})}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-2xl border border-dark-border bg-black/10 px-5 py-3 text-text-main transition hover:border-primary hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : isEditModalOpen ? 'Guardar cambios' : 'Crear documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-text-main">
                  {isUserEditMode ? 'Modificar Usuario' : 'Agregar Usuario'}
                </h2>
                <p className="text-text-main/70">
                  {isUserEditMode
                    ? 'Actualiza los datos del usuario.'
                    : 'Registra un nuevo administrador en el sistema.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUserModal}
                className="rounded-full border border-dark-border bg-black/20 px-3 py-2 text-text-main transition hover:border-primary hover:text-primary"
              >
                X
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isUserEditMode) {
                  handleUpdateUserClick(e);
                } else {
                  handleCreateUserClick(e);
                }
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-text-main">
                  <span>Nombre</span>
                  <input
                    value={userFormState.nombre}
                    onChange={(e) => handleUserFormChange('nombre', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm text-text-main">
                  <span>Email</span>
                  <input
                    type="email"
                    value={userFormState.correo}
                    onChange={(e) => handleUserFormChange('correo', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-text-main">
                  <span>Contraseña</span>
                  <input
                    type="password"
                    value={userFormState.password}
                    onChange={(e) => handleUserFormChange('password', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    placeholder={isUserEditMode ? 'Dejar en blanco para mantener actual' : 'Nueva contraseña'}
                    {...(!isUserEditMode ? { required: true } : {})}
                  />
                </label>
                <label className="space-y-2 text-sm text-text-main">
                  <span>Llave de seguridad</span>
                  <input
                    type="password"
                    value={userFormState.llave_seguridad}
                    onChange={(e) => handleUserFormChange('llave_seguridad', e.target.value)}
                    className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
                    placeholder={isUserEditMode ? "Dejar en blanco para mantener actual" : "Llave de seguridad requerida"}
                    {...(!isUserEditMode ? { required: true } : {})}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeUserModal}
                  className="rounded-2xl border border-dark-border bg-black/10 px-5 py-3 text-text-main transition hover:border-primary hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : isUserEditMode ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isControlKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-2xl custom-scrollbar">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text-main">Verificación de Seguridad</h2>
              <p className="text-text-main/70 text-sm">
                Ingresa tu llave de control para confirmar esta acción.
              </p>
            </div>

            <form onSubmit={handleControlKeySubmit} className="space-y-4">
              <label className="space-y-2 text-sm text-text-main">
                <span>Llave de Control</span>
                <input
                  type="password"
                  value={controlKey}
                  onChange={(e) => setControlKey(e.target.value)}
                  disabled={processingControlKey}
                  className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Ingresa tu PIN de seguridad"
                  required
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!processingControlKey) {
                      setIsControlKeyModalOpen(false);
                      setControlKey('');
                      setPendingAction(null);
                      setProcessingControlKey(false);
                    }
                  }}
                  disabled={processingControlKey}
                  className="rounded-2xl border border-dark-border bg-black/10 px-5 py-3 text-text-main transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processingControlKey}
                  className="rounded-2xl bg-primary px-5 py-3 text-dark-bg transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingControlKey ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPanel;
