import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import AIScoreBadge from '../components/AIScoreBadge';
import { Eye, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const ApplicantsPage = () => {
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        // Obtener postulantes registrados
        const postulanteRef = collection(db, 'postulante');
        const postulanteSnapshot = await getDocs(postulanteRef);
        
        // Obtener respuestas de pruebas
        const responsesRef = collection(db, 'responses');
        const responsesSnapshot = await getDocs(responsesRef);
        
        // Crear mapa de respuestas por DNI
        const responsesMap = new Map();
        responsesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.dni) {
            responsesMap.set(data.dni, {
              id: doc.id,
              submittedAt: data.submittedAt,
              aiAnalysis: data.aiAnalysis,
              hasTest: true
            });
          }
        });
        
        // Combinar datos
        const applicantsData = postulanteSnapshot.docs.map(doc => {
          const postulanteData = doc.data();
          const dni = postulanteData.dni;
          const responseData = responsesMap.get(dni);
          
          return {
            id: responseData?.id || doc.id,
            name: postulanteData.name || 'Sin nombre',
            email: dni || 'Sin DNI',
            appliedAt: responseData?.submittedAt || postulanteData.createdAt,
            status: responseData ? 
              (responseData.aiAnalysis?.finalAssessment?.riskLevel || 'completed') : 
              'not_tested',
            overallAIScore: responseData?.aiAnalysis?.serverResults?.length > 0 
              ? Math.round(responseData.aiAnalysis.serverResults.reduce((sum, result) => sum + (result.score || 0), 0) / responseData.aiAnalysis.serverResults.length)
              : 0,
            hasTest: !!responseData
          };
        });
        
        setApplicants(applicantsData);
      } catch (error) {
        console.error('Error fetching applicants:', error);
        toast.error('Error al cargar postulantes. Reintentando...');
        // Reintentar después de 2 segundos
        setTimeout(() => {
          fetchApplicants();
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicants();
  }, []);

  const filteredApplicants = applicants.filter(applicant => {
    if (filter === 'all') return true;
    if (filter === 'not_tested') return !applicant.hasTest;
    if (filter === 'completed') return applicant.hasTest;
    if (filter === 'low') return applicant.status === 'low';
    if (filter === 'high') return applicant.status === 'high' || applicant.status === 'critical';
    if (filter === 'high-ai') return applicant.overallAIScore > 60;
    return true;
  });

  const getStatusBadge = (status, hasTest) => {
    if (!hasTest) {
      return <span className="badge" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>Sin Prueba</span>;
    }
    
    const statusMap = {
      low: { class: 'badge badge-green', label: 'Bajo Riesgo' },
      moderate: { class: 'badge badge-yellow', label: 'Riesgo Moderado' },
      high: { class: 'badge badge-red', label: 'Alto Riesgo' },
      critical: { class: 'badge badge-red', label: 'Crítico' },
      completed: { class: 'badge badge-green', label: 'Completado' }
    };
    
    const statusInfo = statusMap[status] || { class: 'badge badge-yellow', label: 'Pendiente' };
    return <span className={statusInfo.class}>{statusInfo.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '16rem' }}>
        <div className="animate-spin rounded-full" style={{ 
          width: '2rem', 
          height: '2rem', 
          border: '2px solid #e5e7eb', 
          borderTop: '2px solid #009EE4' 
        }}></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Postulantes</h1>
        <p className="text-gray-600">Gestión y análisis de postulantes</p>
      </div>

      <div className="mb-6 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Filter size={20} className="text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="form-input"
            style={{ width: 'auto' }}
          >
            <option value="all">Todos</option>
            <option value="not_tested">Sin Prueba</option>
            <option value="completed">Con Prueba</option>
            <option value="low">Bajo Riesgo</option>
            <option value="high">Alto Riesgo</option>
            <option value="high-ai">Score IA > 60%</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">
          {filteredApplicants.length} de {applicants.length} postulantes
        </span>
      </div>

      <div className="bg-white shadow rounded-lg" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'var(--gray-50)' }}>
            <tr>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Postulante
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fecha
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estado
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Score IA
              </th>
              <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '500', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'white' }}>
            {filteredApplicants.map((applicant) => (
              <tr key={applicant.id} style={{ borderTop: '1px solid var(--gray-200)' }}>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {applicant.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {applicant.email}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }} className="text-sm text-gray-500">
                  {applicant.appliedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  {getStatusBadge(applicant.status, applicant.hasTest)}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }}>
                  {applicant.hasTest ? (
                    <AIScoreBadge score={applicant.overallAIScore || 0} />
                  ) : (
                    <span className="text-gray-400 text-sm">N/A</span>
                  )}
                </td>
                <td style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap' }} className="text-sm font-medium">
                  {applicant.hasTest ? (
                    <button
                      onClick={() => navigate(`/applicants/${applicant.id}`)}
                      className="flex items-center space-x-1"
                      style={{ color: 'var(--primary-blue)', cursor: 'pointer', background: 'none', border: 'none' }}
                    >
                      <Eye size={16} />
                      <span>Ver Detalle</span>
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin prueba</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredApplicants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No se encontraron postulantes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicantsPage;