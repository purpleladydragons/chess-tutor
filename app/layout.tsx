import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const geistSans=Geist({variable:'--font-geist-sans',subsets:['latin']});
const geistMono=Geist_Mono({variable:'--font-geist-mono',subsets:['latin']});
export async function generateMetadata(): Promise<Metadata> {
  const h=await headers();
  const host=h.get('x-forwarded-host')||h.get('host')||'localhost:3000';
  const protocol=host.startsWith('localhost')?'http':'https';
  return {metadataBase:new URL(`${protocol}://${host}`),title:'Opening Lines — Your personal chess opening explorer',description:'Import your Lichess or Chess.com games and follow your opening paths. Understand every move with clear names, a chessboard, and your win, draw, and loss rates.',icons:{icon:'/favicon.png'},openGraph:{title:'Opening Lines',description:'Your games. A clearer plan.',type:'website',images:[{url:'/og.png',width:1536,height:1024,alt:'Opening Lines — Your games. A clearer plan.'}]},twitter:{card:'summary_large_image',images:['/og.png'],title:'Opening Lines',description:'Your games. A clearer plan.'}};
}
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;}
