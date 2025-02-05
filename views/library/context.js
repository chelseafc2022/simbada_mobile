const LokasiContext = React.createContext();

const LokasiProvider = ({ children }) => {
  const [lokasi, setLokasi] = useState([]);
  return (
    <LokasiContext.Provider value={{ lokasi, setLokasi }}>
      {children}
    </LokasiContext.Provider>
  );
};
export { LokasiProvider, LokasiContext };