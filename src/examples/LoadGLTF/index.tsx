import { useEffect, useRef } from 'react';
import renderProgrem from './render';
const GLTF = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      renderProgrem.init(canvasRef.current);
    }
  }, []);
  return <div ref={canvasRef} style={{ height: '100vh', width: '100vw' }}></div>;
};
export default GLTF;
