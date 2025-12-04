import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Users, Clock, CheckCircle, AlertTriangle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    LT_QR: { total: 0, pending: 0, approved: 0, avgAIScore: 0 },
    LT_UPI: { total: 0, pending: 0, approved: 0, avgAIScore: 0 },
    LT_POS: { total: 0, pending: 0, approved: 0, avgAIScore: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const calculateIABack = (answer) => {
    if (!answer || answer.length < 10) return 20;
    
    let humanScore = 50;
    const text = answer.toLowerCase();
    
    const humanIndicators = [
      /\b(creo|pienso|me parece|considero)\b/g,
      /\b(eh|um|bueno|entonces)\b/g,
      /[.]{2,}|\?{2,}|!{2,}/g,
      /\b(procentaje|porcentage|exito|exelente)\b/g,
      /\b(si falla|si funciona|creo que|tal vez)\b/g,
    ];
    
    humanIndicators.forEach(pattern => {
      const matches = (text.match(pattern) || []).length;
      humanScore += matches * 8;
    });
    
    const aiIndicators = [
      /^(en primer lugar|en segundo lugar|finalmente)/g,
      /\b(implementar|optimizar|eficiencia|escalabilidad)\b/g,
      /^[A-Z][^.!?]*[.!?]\s*[A-Z]/g,
      /\b(es importante destacar|cabe mencionar|es fundamental)\b/g,
    ];
    
    aiIndicators.forEach(pattern => {
      const matches = (text.match(pattern) || []).length;
      humanScore -= matches * 5;
    });
    
    if (answer.length > 200 && !text.includes('.')) humanScore -= 10;
    if (answer.split(' ').length > 50) humanScore -= 5;
    if (!/[.!?]$/.test(answer.trim())) humanScore += 5;
    if (/\b(a|de|en)\s+\b/.test(text)) humanScore += 3;
    if (text.includes('  ')) humanScore += 3;
    
    return Math.max(10, Math.min(95, humanScore));
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const applicantsRef = collection(db, 'responses');
        const snapshot = await getDocs(applicantsRef);
        
        const testStats = {
          LT_QR: { total: 0, pending: 0, approved: 0, totalAIScore: 0 },
          LT_UPI: { total: 0, pending: 0, approved: 0, totalAIScore: 0 },
          LT_POS: { total: 0, pending: 0, approved: 0, totalAIScore: 0 }
        };

        snapshot.forEach((doc) => {
          const data = doc.data();
          const testType = data.testType || 'LT_QR';
          
          if (testStats[testType]) {
            testStats[testType].total++;
            
            const riskLevel = data.aiAnalysis?.finalAssessment?.riskLevel;
            if (!riskLevel || riskLevel === 'low') testStats[testType].pending++;
            if (riskLevel === 'moderate' || riskLevel === 'high') testStats[testType].approved++;
            
            // Calcular score combinado IA Front + Back
            const answers = data.answers || [];
            if (answers.length > 0) {
              let frontTotal = 0;
              let backTotal = 0;
              
              answers.forEach((answer, index) => {
                const serverResult = data.aiAnalysis?.serverResults?.[index];
                const frontScore = serverResult?.score || 0;
                const backScore = calculateIABack(answer);
                
                frontTotal += frontScore;
                backTotal += backScore;
              });
              
              const frontAvg = Math.round(frontTotal / answers.length);
              const backAvg = Math.round(backTotal / answers.length);
              const combinedAvg = Math.round((frontAvg + backAvg) / 2);
              
              testStats[testType].totalAIScore += combinedAvg;
            }
          }
        });

        const finalStats = {};
        Object.keys(testStats).forEach(testType => {
          const stats = testStats[testType];
          finalStats[testType] = {
            total: stats.total,
            pending: stats.pending,
            approved: stats.approved,
            avgAIScore: stats.total > 0 ? Math.round(stats.totalAIScore / stats.total) : 0
          };
        });

        setStats(finalStats);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const createSampleData = async () => {
    setCreating(true);
    try {
      const sampleApplicants = [
        {
          name: 'Juan Pérez',
          email: 'juan.perez@email.com',
          phone: '+51987654321',
          appliedAt: serverTimestamp(),
          status: 'pending',
          overallAIScore: 25,
          notes: 'Candidato prometedor'
        },
        {
          name: 'María García',
          email: 'maria.garcia@email.com',
          phone: '+51987654322',
          appliedAt: serverTimestamp(),
          status: 'approved',
          overallAIScore: 15,
          notes: 'Excelente perfil'
        },
        {
          name: 'Carlos López',
          email: 'carlos.lopez@email.com',
          phone: '+51987654323',
          appliedAt: serverTimestamp(),
          status: 'rejected',
          overallAIScore: 85,
          notes: 'Alto score de IA detectado'
        }
      ];

      const applicantsRef = collection(db, 'responses');
      for (const applicant of sampleApplicants) {
        await addDoc(applicantsRef, applicant);
      }

      toast.success('Datos de prueba creados exitosamente');
      window.location.reload();
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast.error('Error al crear datos de prueba');
    } finally {
      setCreating(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, bgColor }) => (
    <div className="card">
      <div className="flex items-center">
        <div className="p-3 rounded-lg" style={{ backgroundColor: bgColor }}>
          <Icon size={24} color="white" />
        </div>
        <div style={{ marginLeft: '1rem' }}>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen del análisis de postulantes</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
        {Object.entries(stats).map(([testType, testStats]) => (
          <div key={testType} className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">{testType}</h2>
            <div className="space-y-3">
              <StatCard
                title="Total Postulantes"
                value={testStats.total}
                icon={Users}
                bgColor="#3b82f6"
              />
              <StatCard
                title="Pendientes"
                value={testStats.pending}
                icon={Clock}
                bgColor="#eab308"
              />
              <StatCard
                title="Aprobados"
                value={testStats.approved}
                icon={CheckCircle}
                bgColor="#22c55e"
              />
              <StatCard
                title="Score IA Promedio"
                value={`${testStats.avgAIScore}%`}
                icon={AlertTriangle}
                bgColor="#ef4444"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;