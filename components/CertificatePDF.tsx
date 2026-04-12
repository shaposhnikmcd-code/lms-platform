import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 60,
    fontFamily: 'Helvetica',
  },
  border: {
    border: '3px solid #1C3A2E',
    padding: 40,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    color: '#D4A017',
    textTransform: 'uppercase',
    letterSpacing: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  heading: {
    fontSize: 32,
    color: '#1C3A2E',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  text: {
    fontSize: 14,
    color: '#555555',
    marginBottom: 10,
    textAlign: 'center',
  },
  name: {
    fontSize: 28,
    color: '#1C3A2E',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  courseName: {
    fontSize: 20,
    color: '#D4A017',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  divider: {
    width: 200,
    height: 2,
    backgroundColor: '#D4A017',
    marginVertical: 20,
  },
  date: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    fontSize: 11,
    color: '#1C3A2E',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: 'Helvetica-Bold',
  },
});

interface CertificatePDFProps {
  studentName: string;
  courseName: string;
  issuedAt: string;
}

export default function CertificatePDF({ studentName, courseName, issuedAt }: CertificatePDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.title}>Сертифікат про завершення</Text>
          <Text style={styles.heading}>UIMP</Text>
          <Text style={styles.text}>Цим підтверджується, що</Text>
          <Text style={styles.name}>{studentName}</Text>
          <Text style={styles.text}>успішно завершив(ла) курс</Text>
          <Text style={styles.courseName}>{courseName}</Text>
          <View style={styles.divider} />
          <Text style={styles.date}>Дата видачі: {issuedAt}</Text>
          <Text style={styles.footer}>Український інститут психотерапії</Text>
        </View>
      </Page>
    </Document>
  );
}