import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'My Trading Journal',description:'Your trades. Your edge. A personal gold trading journal.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="dark"><body>{children}</body></html>}
