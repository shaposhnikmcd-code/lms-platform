'use client';

import React from "react";
import { FaInstagram, FaYoutube, FaTelegram } from "react-icons/fa";
import { MdSupportAgent } from "react-icons/md";

const sysFont = '-apple-system, BlinkMacSystemFont, sans-serif';

const instagramUrl = "https://www.instagram.com/uimp_psychotherapy";
const youtubeUrl = "https://www.youtube.com/@bible_psychotherapy";
const tgChannelUrl = "https://t.me/shaposhnykpsy";
const tgSupportUrl = "https://t.me/uimp_support";

const sectionStyle: React.CSSProperties = { backgroundColor: '#FAF6F0', padding: '0 48px 64px' };
const containerStyle: React.CSSProperties = { maxWidth: 900, margin: '0 auto' };
const headerStyle: React.CSSProperties = { textAlign: 'center', marginBottom: 40 };
const eyebrowRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 12 };
const lineLeftStyle: React.CSSProperties = { height: 1, width: 60, backgroundImage: 'linear-gradient(to right, transparent, #D4A843)' };
const lineRightStyle: React.CSSProperties = { height: 1, width: 60, backgroundImage: 'linear-gradient(to left, transparent, #D4A843)' };
const eyebrowStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', color: '#D4A843', textTransform: 'uppercase' };
const titleStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 24, fontWeight: 700, color: '#1C3A2E', margin: 0, letterSpacing: '-0.02em' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 };
const cardStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, backgroundColor: 'white', borderRadius: 20, padding: '32px 20px', textDecoration: 'none', boxShadow: '0 2px 12px rgba(28,58,46,0.06)', borderWidth: 1, borderStyle: 'solid', borderColor: 'rgba(28,58,46,0.06)' };
const cardTextStyle: React.CSSProperties = { textAlign: 'center' };
const labelStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 14, fontWeight: 700, color: '#1C3A2E', margin: '0 0 4px' };
const hintStyle: React.CSSProperties = { fontFamily: sysFont, fontSize: 11, color: 'rgba(28,58,46,0.4)', margin: 0, lineHeight: 1.5 };

const instaIconWrap: React.CSSProperties = { width: 56, height: 56, borderRadius: 16, backgroundImage: 'linear-gradient(135deg, #f09433 0%, #e6683c 35%, #dc2743 65%, #bc1888 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const tgIconWrap: React.CSSProperties = { width: 56, height: 56, borderRadius: 16, backgroundColor: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const ytIconWrap: React.CSSProperties = { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FF0000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };

export default function SocialSection() {
  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={eyebrowRowStyle}>
            <div style={lineLeftStyle} />
            <span style={eyebrowStyle}>{"Ми в мережі"}</span>
            <div style={lineRightStyle} />
          </div>
          <h2 style={titleStyle}>{"Залишайтесь на зв'язку"}</h2>
        </div>
        <div style={gridStyle}>

          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" style={cardStyle}>
            <div style={instaIconWrap}>
              <FaInstagram size={24} color="white" />
            </div>
            <div style={cardTextStyle}>
              <p style={labelStyle}>{"Instagram"}</p>
              <p style={hintStyle}>{"Надихаючий контент"}</p>
            </div>
          </a>

          <a href={tgSupportUrl} target="_blank" rel="noopener noreferrer" style={cardStyle}>
            <div style={tgIconWrap}>
              <MdSupportAgent size={24} color="white" />
            </div>
            <div style={cardTextStyle}>
              <p style={labelStyle}>{"Техпідтримка"}</p>
              <p style={hintStyle}>{"Відповімо швидко"}</p>
            </div>
          </a>

          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" style={cardStyle}>
            <div style={ytIconWrap}>
              <FaYoutube size={24} color="white" />
            </div>
            <div style={cardTextStyle}>
              <p style={labelStyle}>{"YouTube"}</p>
              <p style={hintStyle}>{"Відео та вебінари"}</p>
            </div>
          </a>

          <a href={tgChannelUrl} target="_blank" rel="noopener noreferrer" style={cardStyle}>
            <div style={tgIconWrap}>
              <FaTelegram size={24} color="white" />
            </div>
            <div style={cardTextStyle}>
              <p style={labelStyle}>{"ТГ канал"}</p>
              <p style={hintStyle}>{"Новини та анонси"}</p>
            </div>
          </a>

        </div>
      </div>
    </section>
  );
}