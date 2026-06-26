import "../styles/globals.css";

export const metadata = {
  title: "Catálogo de Obra Serigráfica | FAD-UNAM",
  description:
    "Catálogo digital de obra serigráfica de la Facultad de Artes y Diseño, UNAM",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
