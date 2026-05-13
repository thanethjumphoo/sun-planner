// Native fetch is used

const API_URL = 'http://localhost:3333/api/master-yield';

const data = {
  name: 'ไก่เป็น',
  yieldPercentage: 1.0,
  type: 'ROOT',
  children: [
    { name: 'ขนไก่', yieldPercentage: 0.075, type: 'PRODUCT' },
    { name: 'หัวไก่', yieldPercentage: 0.023, type: 'PRODUCT' },
    { name: 'เลือด', yieldPercentage: 0.05, type: 'PRODUCT' },
    { name: 'ขาไก่', yieldPercentage: 0.023, type: 'PRODUCT' },
    { 
      name: 'สันใน', yieldPercentage: 0.04, type: 'CATEGORY',
      children: [
        { name: 'process: 1', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'สันใน unsize', yieldPercentage: 0.98, type: 'PRODUCT' },
          { name: 'ลูกสันใน', yieldPercentage: 0.008, type: 'PRODUCT' },
          { name: 'เศษสันใน', yieldPercentage: 0.002, type: 'PRODUCT' }
        ]},
        { name: 'process: 2', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'สันใน T/C', yieldPercentage: 0.92, type: 'PRODUCT' },
          { name: 'เศษสันในติดเอ็น', yieldPercentage: 0.08, type: 'PRODUCT' }
        ]},
        { name: 'process: 3', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'สันใน W/O tendon', yieldPercentage: 0.85, type: 'PRODUCT' },
          { name: 'เศษสันในติดเอ็น', yieldPercentage: 0.10, type: 'PRODUCT' },
          { name: 'เศษสันใน', yieldPercentage: 0.05, type: 'PRODUCT' }
        ]}
      ]
    },
    {
      name: 'BIL L/C', yieldPercentage: 0.25, type: 'CATEGORY',
      children: [
        { name: 'process: 1', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'BIL S/C', yieldPercentage: 0.96, type: 'PRODUCT' },
          { name: 'ข้อสั้น', yieldPercentage: 0.04, type: 'PRODUCT' }
        ]},
        { name: 'process: 2', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'น่อง', yieldPercentage: 0.40, type: 'PRODUCT' },
          { name: 'สะโพก', yieldPercentage: 0.55, type: 'PRODUCT' },
          { name: 'ข้อสั้น', yieldPercentage: 0.04, type: 'PRODUCT' },
          { name: 'หนังติดมันเกรด A', yieldPercentage: 0.01, type: 'PRODUCT' }
        ]},
        { name: 'process: 3', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'BL แผ่น', yieldPercentage: 0.745, type: 'PRODUCT' },
          { name: 'หนังติดมันเกรด A', yieldPercentage: 0.028, type: 'PRODUCT' },
          { name: 'เศษ BL no.2', yieldPercentage: 0.004, type: 'PRODUCT' },
          { name: 'เศษเนื้อแข้งติดกระดูก', yieldPercentage: 0.0, type: 'PRODUCT' },
          { name: 'กระดูกน่องสะโพกติดข้อเต็ม', yieldPercentage: 0.206, type: 'PRODUCT' },
          { name: 'กระดูกน่อง', yieldPercentage: 0.0, type: 'PRODUCT' },
          { name: 'knee tendon', yieldPercentage: 0.008, type: 'PRODUCT' }
        ]}
      ]
    },
    {
      name: 'BB', yieldPercentage: 0.225, type: 'CATEGORY',
      children: [
        { name: 'process: 1', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'BB อกคู่ตัดติ่ง', yieldPercentage: 0.93, type: 'PRODUCT' },
          { name: 'เศษ BB', yieldPercentage: 0.02, type: 'PRODUCT' },
          { name: 'ติ่ง BB', yieldPercentage: 0.045, type: 'PRODUCT' },
          { name: 'เศษหนัง', yieldPercentage: 0.005, type: 'PRODUCT' }
        ]},
        { name: 'process: 2', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'BB อกคู่ไม่ตัดติ่ง', yieldPercentage: 0.975, type: 'PRODUCT' },
          { name: 'เศษ BB', yieldPercentage: 0.02, type: 'PRODUCT' },
          { name: 'เศษหนัง', yieldPercentage: 0.005, type: 'PRODUCT' }
        ]},
        { name: 'process: 3', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'SBB อกคู่', yieldPercentage: 0.83, type: 'PRODUCT' },
          { name: 'SKIN BB', yieldPercentage: 0.10, type: 'PRODUCT' },
          { name: 'ติ่ง BB', yieldPercentage: 0.045, type: 'PRODUCT' },
          { name: 'เศษ BB', yieldPercentage: 0.02, type: 'PRODUCT' },
          { name: 'เศษ SBB', yieldPercentage: 0.005, type: 'PRODUCT' }
        ]},
        { name: 'process: 4', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'SBB อกคู่', yieldPercentage: 0.80, type: 'PRODUCT' },
          { name: 'SKIN BB', yieldPercentage: 0.10, type: 'PRODUCT' },
          { name: 'ติ่ง BB', yieldPercentage: 0.045, type: 'PRODUCT' },
          { name: 'เศษ BB', yieldPercentage: 0.05, type: 'PRODUCT' },
          { name: 'เศษ SBB', yieldPercentage: 0.005, type: 'PRODUCT' }
        ]}
      ]
    },
    {
      name: '3JW', yieldPercentage: 0.076, type: 'CATEGORY',
      children: [
        { name: 'process: 1', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: '2JW', yieldPercentage: 0.48, type: 'PRODUCT' },
          { name: 'WS', yieldPercentage: 0.52, type: 'PRODUCT' }
        ]},
        { name: 'process: 2', yieldPercentage: 1.0, type: 'PROCESS', children: [
          { name: 'MW', yieldPercentage: 0.36, type: 'PRODUCT' },
          { name: 'WING TIP', yieldPercentage: 0.12, type: 'PRODUCT' },
          { name: 'WS', yieldPercentage: 0.52, type: 'PRODUCT' }
        ]}
      ]
    },
    {
      name: 'เครื่องในไก่', yieldPercentage: 0.058, type: 'CATEGORY',
      children: [
        { name: 'ตับไก่', yieldPercentage: 0.27, type: 'PRODUCT' },
        { name: 'หัวใจไก่', yieldPercentage: 0.07, type: 'PRODUCT' },
        { name: 'กึ๋นไก่', yieldPercentage: 0.13, type: 'PRODUCT' },
        { name: 'ดีไก่', yieldPercentage: 0.02, type: 'PRODUCT' },
        { name: 'ไส้ไก่', yieldPercentage: 0.42, type: 'PRODUCT' },
        { name: 'ม้ามไก่', yieldPercentage: 0.02, type: 'PRODUCT' }
      ]
    },
    {
      name: 'โครงไก่', yieldPercentage: 0.18, type: 'CATEGORY',
      children: [
        { name: 'เนื้อคอ', yieldPercentage: 0.026, type: 'PRODUCT' },
        { name: 'หนังคอ', yieldPercentage: 0.10, type: 'PRODUCT' },
        { name: 'เนื้อช่องท้อง', yieldPercentage: 0.05, type: 'PRODUCT' },
        { name: 'กระดูกอ่อน', yieldPercentage: 0.008, type: 'PRODUCT' },
        { name: 'บั้นท้าย', yieldPercentage: 0.04, type: 'PRODUCT' },
        { name: 'มันช่องท้อง', yieldPercentage: 0.0014, type: 'PRODUCT' },
        { name: 'โครงเลาะ', yieldPercentage: 0.76, type: 'PRODUCT' }
      ]
    }
  ]
};

async function seedNode(node, parentId = null) {
  try {
    const payload = {
      name: node.name,
      yieldPercentage: node.yieldPercentage,
      type: node.type,
      parentId: parentId
    };
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    console.log(`Created: ${node.name}`);
    
    const createdId = data.id;
    
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        await seedNode(child, createdId);
      }
    }
  } catch (err) {
    console.error(`Error creating ${node.name}:`, err.message);
  }
}

async function main() {
  console.log('Starting seed...');
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const existing = await res.json();
      for (const root of existing) {
        console.log(`Deleting existing root: ${root.name}`);
        await fetch(`${API_URL}/${root.id}`, { method: 'DELETE' });
      }
    }
  } catch(e) {
    console.log('Failed to delete existing or none exists.', e.message);
  }
  
  await seedNode(data);
  console.log('Done!');
}

main();
