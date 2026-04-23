
function readDataTable() {
  const table = document.querySelector('#tabelaResultados');

  if (!table) {
      chrome.runtime.sendMessage({ error: 'Tabela com id="tabelaResultados" não foi encontrada na página.' });
      return;
}

const rows = table.querySelectorAll('tbody tr');
const clients = [];

  rows.forEach(row => {
    const columns = row.querySelectorAll("td");

    if (columns.length >= 6) {
        const nameClientRaw = columns[0].innerText.trim();
        const typeCertifie = columns[4].innerText.trim();
        const dateEnd = columns[5].innerText.trim();
        let telefoneFinal = 'Telefone não encontrado';
        const celulaContato = columns[2]; 
      
      if (celulaContato) {
        const todosOsSpans = celulaContato.querySelectorAll('span');
        
        // Se houver spans, tenta pegar o número de um deles
        let telefoneEncontrado = false;
        for (const span of todosOsSpans) {
          const textoDoSpan = span.innerText;
          const digitosEncontrados = textoDoSpan.match(/\d/g);

          if (digitosEncontrados && digitosEncontrados.length >= 8) {
            const apenasNumeros = digitosEncontrados.join('');
            if (apenasNumeros.length >= 10) {
              telefoneFinal = '+55' + apenasNumeros;
            } else {
               telefoneFinal = '+55' + apenasNumeros; // Fallback para fixos ou números sem DDD longo
            }
            telefoneEncontrado = true;
            break; 
          }
        }

        // Caso não tenha spans ou não encontrou nos spans, tenta o texto direto da célula
        if (!telefoneEncontrado) {
          const textoDireto = celulaContato.innerText;
          const digitosDireto = textoDireto.match(/\d/g);
          if (digitosDireto && digitosDireto.length >= 8) {
            telefoneFinal = '+55' + digitosDireto.join('');
          }
        }
      }

    let nameClientClean;
    if (nameClientRaw.includes("Indicação:")) {
      nameClientClean = nameClientRaw.split("Indicação:")[0].trim();
    } else {
      nameClientClean = nameClientRaw;
    }
    
    const clienteId = `${nameClientRaw}#${typeCertifie}`;

    clients.push({
      id: clienteId,
      name: nameClientClean,
      type: typeCertifie,
      dateEnd: dateEnd,
      tel: telefoneFinal,
    })
    }
    const clientesUnicos = [...new Map(clients.map(client => [client.id, client])).values()];

    // Enviamos a lista de clientes únicos para o popup
    chrome.runtime.sendMessage({ data: clientesUnicos });
  });
}

readDataTable();