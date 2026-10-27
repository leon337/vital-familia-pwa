import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Vital Família · Demonstração',description:'Protótipo sintético de acompanhamento familiar',applicationName:'Vital Família',icons:{apple:'/icon-192.png'},appleWebApp:{capable:true,title:'Vital Família',statusBarStyle:'default'}};
export const viewport:Viewport={themeColor:'#145c4d',width:'device-width',initialScale:1};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
