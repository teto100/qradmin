import { useState, useRef } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ReCAPTCHA from 'react-google-recaptcha';
import LoginLogger from '../services/loginLogger';
import { setLastLoginTime } from '../services/sessionManager';
import { initLoginLogsCollection, initAppConfig } from '../utils/initFirebase';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();
  
  const isCaptchaEnabled = import.meta.env.VITE_ENABLE_CAPTCHA === 'true';
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (isCaptchaEnabled && !captchaToken) {
      toast.error('Por favor completa el CAPTCHA');
      return;
    }
    
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Inicializar colecciones después del login exitoso
      try {
        await initLoginLogsCollection();
        await initAppConfig();
      } catch (initError) {
        // Ignorar si ya existen
      }
      
      // Registrar login exitoso en Firebase
      await LoginLogger.logLogin(userCredential.user.email);
      setLastLoginTime();
      
      toast.success('Inicio de sesión exitoso');
      navigate('/');
    } catch (error) {
      // Registrar intento fallido en Firebase
      await LoginLogger.logFailedLogin(email, error.code);
      
      toast.error('Credenciales incorrectas. Verifica tu email y contraseña.');
      if (isCaptchaEnabled && recaptchaRef.current) {
        recaptchaRef.current.reset();
        setCaptchaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f3f4f6' }}>
      {/* Panel izquierdo */}
      <div 
        style={{ 
          width: '50%', 
          background: 'linear-gradient(135deg, #009EE4 0%, #0F206C 100%)',
          padding: '3rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ maxWidth: '400px', color: 'white' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
            Panel Administrativo
          </h1>
          <p style={{ fontSize: '1.25rem', marginBottom: '2rem', opacity: 0.9, lineHeight: '1.6' }}>
            Gestiona y analiza las respuestas de los postulantes con herramientas avanzadas.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#93c5fd', borderRadius: '50%', marginRight: '12px' }}></div>
              <span style={{ color: '#93c5fd' }}>Análisis automático de respuestas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#93c5fd', borderRadius: '50%', marginRight: '12px' }}></div>
              <span style={{ color: '#93c5fd' }}>Detección de contenido IA</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '8px', height: '8px', backgroundColor: '#93c5fd', borderRadius: '50%', marginRight: '12px' }}></div>
              <span style={{ color: '#93c5fd' }}>Reportes detallados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ 
        width: '50%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '2rem' 
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '1rem', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
            padding: '2rem' 
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                background: 'linear-gradient(135deg, #009EE4 0%, #0F206C 100%)', 
                borderRadius: '12px', 
                margin: '0 auto 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <div style={{ width: '24px', height: '24px', backgroundColor: 'white', borderRadius: '8px' }}></div>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                Iniciar Sesión
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Ingresa tus credenciales para acceder
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  placeholder="tu@email.com"
                  onFocus={(e) => e.target.style.borderColor = '#009EE4'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  placeholder="••••••••"
                  onFocus={(e) => e.target.style.borderColor = '#009EE4'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              {isCaptchaEnabled && recaptchaSiteKey && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={recaptchaSiteKey}
                    onChange={handleCaptchaChange}
                  />
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading || (isCaptchaEnabled && !captchaToken)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #009EE4 0%, #0F206C 100%)',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  border: 'none',
                  cursor: (loading || (isCaptchaEnabled && !captchaToken)) ? 'not-allowed' : 'pointer',
                  opacity: (loading || (isCaptchaEnabled && !captchaToken)) ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid rgba(255,255,255,0.3)', 
                      borderTop: '2px solid white', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite' 
                    }}></div>
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                Acceso restringido solo para administradores
              </p>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default LoginPage;