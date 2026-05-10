import React from 'react';
import PatientInfoCard from './PatientInfoCard';
import ScanResultCard from './ScanResultCard';
import DashboardStats from './DashboardStats';
import RiskScoreCard from './RiskScoreCard';

const TEXT_ONLY_TYPES = ['text', 'greeting', 'goodbye', 'thanks', 'aide', 'birads', 'cancer_info', undefined];

const msgStyles = `
  @keyframes ps-msg-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
  .ps-msg-row { display:flex; margin-bottom:12px; animation:ps-msg-in .2s both; }
  .ps-msg-row.user  { justify-content:flex-end; }
  .ps-msg-row.bot   { justify-content:flex-start; }

  .ps-avatar {
    width:30px; height:30px; border-radius:50%; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    font-size:10px; font-weight:700;
  }
  .ps-avatar.ai {
    background:linear-gradient(135deg,#7f1d3a,#e11d48);
    color:#fff; margin-right:8px;
    box-shadow:0 2px 10px rgba(225,29,72,.3);
  }
  .ps-avatar.user {
    background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1);
    color:rgba(148,163,184,.8); margin-left:8px;
  }

  .ps-bubble {
    max-width:82%; border-radius:16px; padding:10px 14px;
    font-size:13px; line-height:1.55;
  }
  .ps-bubble.user {
    background:linear-gradient(135deg,#7f1d3a,#e11d48);
    color:#fff;
    border-bottom-right-radius:4px;
    box-shadow:0 4px 16px rgba(225,29,72,.25);
  }
  .ps-bubble.bot {
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.08);
    color:#e2e8f0;
    border-bottom-left-radius:4px;
  }

  .ps-conf-bar {
    height:2px; border-radius:1px;
    background:rgba(255,255,255,.08); overflow:hidden; margin-top:8px;
  }
  .ps-conf-fill {
    height:100%; border-radius:1px;
    background:linear-gradient(90deg,#e11d48,#fb7185);
    transition:width .5s;
  }
  .ps-conf-label { font-size:10px; color:rgba(148,163,184,.5); margin-top:3px; text-align:right; }
`;

const ChatMessage = ({ message }) => {
  const isUser = message.sender === 'user';

  const renderContent = () => {
    if (isUser) return <span>{message.text}</span>;

    switch (message.type) {
      case 'patient_info':
        return <><p style={{ marginBottom:8, color:'#cbd5e1' }}>{message.text}</p><PatientInfoCard patient={message.data} /></>;
      case 'scan_result':
        return <><p style={{ marginBottom:8, color:'#cbd5e1' }}>{message.text}</p><ScanResultCard scan={message.data} /></>;
      case 'dashboard':
        return <><p style={{ marginBottom:8, color:'#cbd5e1' }}>{message.text}</p><DashboardStats stats={message.data} /></>;
      case 'risk':
        return (
          <>
            <p style={{ marginBottom:8, color:'#cbd5e1' }}>{message.text}</p>
            {typeof message.risk_score === 'number' && <RiskScoreCard score={message.risk_score} />}
          </>
        );
      default:
        return (
          <>
            <p style={{ whiteSpace:'pre-wrap' }}>{message.text}</p>
            {typeof message.confidence === 'number' &&
              message.confidence > 0 &&
              !TEXT_ONLY_TYPES.includes(message.type) && (
              <>
                <div className="ps-conf-bar">
                  <div className="ps-conf-fill" style={{ width:`${message.confidence * 100}%` }} />
                </div>
                <div className="ps-conf-label">
                  Confiance : {(message.confidence * 100).toFixed(1)}%
                </div>
              </>
            )}
          </>
        );
    }
  };

  return (
    <>
      <style>{msgStyles}</style>
      <div className={`ps-msg-row ${isUser ? 'user' : 'bot'}`}>
        {!isUser && <div className="ps-avatar ai">AI</div>}
        <div className={`ps-bubble ${isUser ? 'user' : 'bot'}`}>
          {renderContent()}
        </div>
        {isUser && <div className="ps-avatar user">U</div>}
      </div>
    </>
  );
};

export default ChatMessage;