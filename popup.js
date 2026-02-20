// Variável global para manter os dados dos clientes extraídos
let lastExtractedClients = [];

async function getContactedClients() {
  const result = await chrome.storage.local.get(['contactedClients']);
  const contacted = result.contactedClients || {};
  const umaSemanaAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentContacts = {};
  for (const id in contacted) {
    if (contacted[id] > umaSemanaAtras) {
      recentContacts[id] = contacted[id];
    }
  }
  await chrome.storage.local.set({ contactedClients: recentContacts });
  return recentContacts;
}

async function saveContactedClient(clientId, templateId) {
  const result = await chrome.storage.local.get(['contactedClients']);
  const contacted = result.contactedClients || {};
  // Chave composta: templateID + _ + clientID
  const historyKey = `${templateId}_${clientId}`;
  contacted[historyKey] = Date.now();
  await chrome.storage.local.set({ contactedClients: contacted });
}

async function removeContactedClient(clientId, templateId) {
  const result = await chrome.storage.local.get(['contactedClients']);
  const contacted = result.contactedClients || {};
  const historyKey = `${templateId}_${clientId}`;
  delete contacted[historyKey];
  await chrome.storage.local.set({ contactedClients: contacted });
}


async function handleClick(e) {
  clickedButton = e.target;

  const textToCopy = clickedButton.dataset.text;
  const tel = clickedButton.dataset.tel;
  const clientId = clickedButton.dataset.clientId;

  if (!textToCopy || !tel || !clientId) {
    console.error('Dados não encontrados no botão.');
    return;
  }
  navigator.clipboard.writeText(textToCopy).then(() => {
    const linkWhatsapp = `whatsapp://send?phone=${tel}`;
    window.open(linkWhatsapp, '_blank');
  });
}
async function handleClickSave(e) {
  const clickedButton = e.target;
  const clientId = clickedButton.dataset.clientId;
  const templateId = getSelectedTemplateId();

  if (!clientId || !templateId) {
    console.error('Dados não encontrados para salvar.');
    return;
  }
  await saveContactedClient(clientId, templateId);

  // Re-renderiza as listas para mover o cliente
  const contactedIds = await getContactedClients();
  processAndShowResult(lastExtractedClients, contactedIds);
}

async function handleClickUndo(e) {
  const clickedButton = e.target;
  const clientId = clickedButton.dataset.clientId;
  const templateId = getSelectedTemplateId();

  if (!clientId || !templateId) return;

  await removeContactedClient(clientId, templateId);
  const contactedIds = await getContactedClients();
  processAndShowResult(lastExtractedClients, contactedIds);
}



const DEFAULT_TEMPLATES = [
  {
    id: 'def-group',
    title: 'Mensagem Padrão',
    textCNPJ: 'Bom dia/ Boa tarde!\nPrezado(a) @empresa\nO certificado digital @tipo-certificado da sua empresa @status dia @data\nPara evitar transtornos eventuais e garantir a continuidade de suas operações sem interrupções, recomendamos que a renovação seja feita o quanto antes.\nEstamos a disposição para ajudá-lo(a) com um processo de atualização ágil e eficiente.\nEntre em contato e garanta a continuidade de seus serviços sem preocupações.\nAtenciosamente,\nDigitalSafe.',
    textCPF: 'Bom dia/ Boa tarde!\nPrezado (a), @nome\nO seu certificado digital @tipo-certificado @status dia @data\nPara evitar transtornos eventuais e garantir a continuidade de suas operações sem interrupções, recomendamos que a renovação seja feita o quanto antes.\nEstamos a disposição para ajudá-lo(a) com um processo de atualização ágil e eficiente. Entre em contato e garanta a continuidade de seus serviços sem preocupações.\nAtenciosamente,\nDigitalSafe'
  }
];

function getTemplates() {
  const saved = localStorage.getItem('messageTemplates');
  return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
}

function saveTemplates(templates) {
  localStorage.setItem('messageTemplates', JSON.stringify(templates));
}

function getSelectedTemplateId() {
  return localStorage.getItem('selectedTemplateId') || 'def-group';
}

function setSelectedTemplateId(id) {
  localStorage.setItem('selectedTemplateId', id);
}

function renderTemplates() {
  const container = document.getElementById('container-templates');
  const templates = getTemplates();
  const selectedId = getSelectedTemplateId();

  container.innerHTML = '';
  templates.forEach(tpl => {
    const div = document.createElement('div');
    div.className = `msg-item ${tpl.id == selectedId ? 'selected' : ''}`;

    div.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; color: #333;">${tpl.title}</div>
      <div class="msg-text" style="color: #666; font-size: 11px;">CNPJ: ${tpl.textCNPJ.substring(0, 40)}...</div>
      <div class="msg-text" style="color: #666; font-size: 11px;">CPF: ${tpl.textCPF.substring(0, 40)}...</div>
      <div class="msg-actions">
        <label style="cursor: pointer; font-size: 13px;">
          <input type="radio" name="selected-tpl" value="${tpl.id}" ${tpl.id == selectedId ? 'checked' : ''}> Selecionar
        </label>
        ${tpl.id === 'def-group' ? '' : `<button class="btn-delete-msg" style="padding: 4px 10px;" data-id="${tpl.id}">Excluir</button>`}
      </div>
    `;

    const radio = div.querySelector('input[type="radio"]');
    radio.onchange = async () => {
      setSelectedTemplateId(tpl.id);
      renderTemplates();
      // Ao mudar de template, re-renderiza as listas de envio
      const contactedIds = await getContactedClients();
      processAndShowResult(lastExtractedClients, contactedIds);
    };

    const delBtn = div.querySelector('.btn-delete-msg');
    if (delBtn) {
      delBtn.onclick = () => {
        const filtered = getTemplates().filter(t => t.id != tpl.id);
        saveTemplates(filtered);
        if (getSelectedTemplateId() == tpl.id) setSelectedTemplateId('def-group');
        renderTemplates();
      };
    }

    container.appendChild(div);
  });
}

function fillTemplate(templateText, client) {
  let dateEnd = client.dateEnd;
  let [day, month, year] = dateEnd.split("/");
  let dateEndFormated = new Date(year, month - 1, day);
  let today = new Date();
  today.setHours(0, 0, 0, 0);

  let status = (dateEndFormated >= today) ? "vence" : "venceu";

  let text = templateText;
  text = text.replace(/@nome/g, client.name);
  text = text.replace(/@empresa/g, client.name); // Using client.name for both as per existing logic
  text = text.replace(/@data/g, client.dateEnd);
  text = text.replace(/@tipo-certificado/g, client.type);
  text = text.replace(/@status/g, status);

  return text;
}

function processAndShowResult(clients, contactedIds) {
  lastExtractedClients = clients; // Salva globalmente
  const containerClients = document.getElementById("container-clients");
  const containerSent = document.getElementById("container-clients-sent");

  containerClients.innerHTML = "";
  containerSent.innerHTML = "";

  const templates = getTemplates();
  const selectedId = getSelectedTemplateId();
  const activeGroup = templates.find(t => t.id == selectedId) || templates[0];

  if (clients.length === 0) {
    containerClients.innerHTML = "<p>Nenhum cliente encontrado na tabela.</p>";
    return;
  }

  clients.forEach(client => {
    const historyKey = `${selectedId}_${client.id}`;
    const isSent = !!contactedIds[historyKey];

    const isCNPJ = client.type.toUpperCase().includes("CNPJ");
    const templateToUse = isCNPJ ? activeGroup.textCNPJ : activeGroup.textCPF;
    const finalText = fillTemplate(templateToUse, client);

    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-client';

    const textP = document.createElement('p');
    textP.innerText = finalText;

    const actionsDiv = document.createElement('div');

    if (!isSent) {
      // Botões para aba "A Enviar"
      const btnSave = document.createElement('button');
      btnSave.className = 'btn-done';
      btnSave.innerText = "Concluído";
      btnSave.dataset.clientId = client.id;
      btnSave.onclick = handleClickSave;

      const btnWhatsapp = document.createElement('button');
      btnWhatsapp.className = 'btn-zap';
      btnWhatsapp.innerText = "Enviar por Zap";
      btnWhatsapp.dataset.text = finalText;
      btnWhatsapp.dataset.tel = client.tel;
      btnWhatsapp.dataset.clientId = client.id;
      btnWhatsapp.onclick = (e) => {
        handleClick(e);
        // Opcional: Marcar como concluído automaticamente ao clicar em Zap?
        // Por enquanto deixamos o usuário clicar em Concluído manualmente como solicitado.
      };

      actionsDiv.appendChild(btnSave);
      actionsDiv.appendChild(btnWhatsapp);
      itemDiv.appendChild(textP);
      itemDiv.appendChild(actionsDiv);
      containerClients.appendChild(itemDiv);
    } else {
      // Botões para aba "Enviados"
      const btnUndo = document.createElement('button');
      btnUndo.className = 'btn-undo';
      btnUndo.innerText = "Desfazer";
      btnUndo.dataset.clientId = client.id;
      btnUndo.onclick = handleClickUndo;

      actionsDiv.appendChild(btnUndo);
      itemDiv.appendChild(textP);
      itemDiv.appendChild(actionsDiv);
      containerSent.appendChild(itemDiv);
    }
  });

  if (containerClients.innerHTML === "") {
    containerClients.innerHTML = "<p>Todos os clientes deste grupo já foram contatados! 🎉</p>";
  }
  if (containerSent.innerHTML === "") {
    containerSent.innerHTML = "<p style='color: #999; font-style: italic;'>Nenhuma mensagem enviada ainda com este grupo.</p>";
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Tab Switching
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');

      if (tab.dataset.tab === 'tab-mensagens') {
        renderTemplates();
      }
    };
  });

  // Add Template Logic
  const btnAdd = document.getElementById('btn-add-template');
  const inputTitle = document.getElementById('input-new-title');
  const inputMsgCNPJ = document.getElementById('input-new-msg-cnpj');
  const inputMsgCPF = document.getElementById('input-new-msg-cpf');

  btnAdd.onclick = () => {
    const title = inputTitle.value.trim();
    const textCNPJ = inputMsgCNPJ.value.trim();
    const textCPF = inputMsgCPF.value.trim();

    if (!title || !textCNPJ || !textCPF) {
      alert("Por favor, preencha o título e as duas mensagens (CNPJ e CPF).");
      return;
    }

    const templates = getTemplates();
    const newTpl = {
      id: Date.now(),
      title: title,
      textCNPJ: textCNPJ,
      textCPF: textCPF
    };

    templates.push(newTpl);
    saveTemplates(templates);

    // Clear inputs
    inputTitle.value = '';
    inputMsgCNPJ.value = '';
    inputMsgCPF.value = '';

    renderTemplates();
  };

  // Initial Load
  const container = document.getElementById('container-clients');
  container.innerHTML = '<p>Verificando contatos anteriores...</p>';

  const contactedIds = await getContactedClients();
  chrome.runtime.onMessage.addListener((message) => {
    if (message.data) {
      processAndShowResult(message.data, contactedIds);
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      });
    }
  });
});
