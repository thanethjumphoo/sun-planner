---
name: Sun-Planner
description: Production Planning Tool & Dashboard
colors:
  primary: "#f97316"
  primary-hover: "#ea580c"
  primary-light: "#ffedd5"
  neutral-bg: "#f8fafc"
  neutral-text: "#1e293b"
  neutral-border: "#cbd5e1"
typography:
  body:
    fontFamily: "'Inter', system-ui, sans-serif"
rounded:
  md: "0.375rem"
  lg: "0.5rem"
spacing:
  sm: "0.5rem"
  md: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
---

# Design System: Sun-Planner

## 1. Overview

**Creative North Star: "The Clarity Dashboard"**

ระบบ Sun-Planner เป็นเครื่องมือวางแผนการผลิตที่มุ่งเน้นการใช้งานจริงและลดความซับซ้อนของข้อมูล ด้วยปรัชญาการออกแบบที่เรียบง่าย สะอาดตา และเน้นความชัดเจน หน้าที่หลักของการออกแบบคือการจัดระเบียบตารางและตัวเลขจำนวนมากให้สามารถทำความเข้าใจได้ง่ายในสภาพแวดล้อมที่เร่งรีบของโรงงาน ระบบนี้ปฏิเสธการตกแต่งที่ล้นเกิน ความรกทึบ และแอนิเมชันที่ไม่จำเป็น เพื่อให้สายตาของผู้ใช้จดจ่ออยู่กับสิ่งที่สำคัญที่สุด: ข้อมูลการผลิต

**Key Characteristics:**
- **Clarity First:** ตัวเลขเด่นชัด ลดเส้นขอบที่ไม่จำเป็น
- **High Contrast:** โทนสีและขนาดตัวอักษรอ่านง่ายบนทุกหน้าจอ
- **Friendly Professionalism:** ใช้สีส้มสว่างเพิ่มความตื่นตัว แต่ยังคงความน่าเชื่อถือ

## 2. Colors

ชุดสีที่ดึงเอาบรรยากาศความตื่นตัวมาผสมกับความสะอาดตาอย่างเป็นระเบียบ

### Primary
- **Vibrant Tangerine** (#F97316): สีส้มสดใสและเป็นมิตร ใช้เป็นแอคชันหลัก (ปุ่ม บันทึก) และจุดสนใจ (Highlight) ที่ต้องการให้ผู้ใช้สังเกตเห็นทันที

### Neutral
- **Cool Paper** (#F8FAFC): สีพื้นหลังหน้าเว็บ (Body Background) ให้ความรู้สึกสะอาด สบายตา ไม่สว่างจ้าเกินไปเมื่อมองนานๆ
- **Ink Slate** (#1E293B): สีของข้อความหลัก ให้คอนทราสต์ที่คมชัดอ่านง่ายกว่าสีดำสนิท
- **Soft Border** (#CBD5E1): สีเส้นขอบตารางและกรอบการ์ด เน้นให้เส้นเบาบางที่สุดเพื่อไม่ให้แย่งความสนใจจากตัวอักษร

**The Restrained Highlight Rule.** การใช้สีสันจะถูกจำกัดไว้ที่ปุ่มและสถานะสำคัญเท่านั้น พื้นที่ส่วนใหญ่ของหน้าจอ (กว่า 90%) จะต้องเป็นสี Neutral เพื่อคุมไม่ให้ระบบดูรกและลายตา

## 3. Typography

**Body Font:** Inter (with system-ui, sans-serif)

**Character:** ทันสมัย เป็นกลาง อ่านง่ายในสเกลเล็กๆ เหมาะสำหรับตัวเลขและตารางข้อมูล

### Hierarchy
- **Headline** (600, 1.5rem, 1.2): ใช้สำหรับหัวเรื่องหลักของหน้าจอหรือ Section
- **Title** (500, 1.125rem, 1.4): ใช้สำหรับชื่อตาราง หรือหัวข้อย่อยของการ์ด
- **Body** (400, 0.875rem, 1.5): ใช้สำหรับตารางข้อมูลหลักและข้อความทั่วไป
- **Label** (500, 0.75rem, uppercase): ใช้สำหรับ Badge สถานะ หรือส่วนหัวคอลัมน์ตาราง

**The Tabular Clarity Rule.** ตัวเลขในตารางต้องจัดชิดขวาเสมอ (Right-aligned) และใช้ฟอนต์ที่มีความกว้างเท่ากัน (Tabular figures) หากจำเป็น เพื่อให้ผู้ใช้อ่านเปรียบเทียบค่าได้อย่างรวดเร็ว

## 4. Elevation

ปรัชญาของ UI คือการผสมผสานความแบนราบ (Flat) กับเงาที่ตอบสนองเมื่อผู้ใช้มีปฏิสัมพันธ์ (Tactile & Layered)

### Shadow Vocabulary
- **Resting Card** (`box-shadow: none` / `border: 1px solid var(--neutral-border)`): การ์ดข้อมูลทั่วไปในสภาวะปกติ จะแบนราบและมีเพียงเส้นขอบบางๆ 
- **Hover Lift** (`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)`): เงาเบาๆ ที่ปรากฏเมื่อเอาเมาส์ชี้ปุ่มหรือการ์ดที่คลิกได้ ให้ความรู้สึกว่าวัตถุลอยขึ้นมารับนิ้ว
- **Dropdown/Modal** (`box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1)`): เงาลึกเพื่อแยก Layer ของหน้าต่างที่ลอยซ้อนทับขึ้นมาอย่างชัดเจน

**The Tactile Feedback Rule.** เงาและแอนิเมชันขนาดเล็ก จะสงวนไว้ใช้กับสิ่งที่มี Action ได้เท่านั้น หากเป็นข้อมูลแสดงผลเฉยๆ ห้ามใส่เงา

## 5. Components

### Buttons
- **Shape:** มุมโค้งมนปานกลาง (0.375rem / 6px)
- **Primary:** ปุ่มส้มสดใส (#F97316) อักษรสีขาว Padding กะทัดรัด
- **Hover / Focus:** สีปุ่มจะเข้มขึ้นเล็กน้อย (#EA580C) พร้อมมีเงาลอยขึ้น (Hover Lift)

### Cards / Containers
- **Corner Style:** 0.5rem (8px)
- **Background:** สีขาวบริสุทธิ์ (#FFFFFF) ทับบนพื้นหลัง Cool Paper 
- **Shadow Strategy:** แบนราบเป็นค่าเริ่มต้น (Resting Card)

### Tables
- **Style:** เส้นขอบบาง (Soft Border) หัวตารางใช้พื้นหลังสีเทาอ่อน (เช่น Slate 50) เพื่อแยกชั้นข้อมูลชัดเจน

## 6. Do's and Don'ts

### Do:
- **Do** ใช้สี Neutral ในพื้นที่ส่วนใหญ่ของหน้าจอ ปล่อยให้สีส้ม Primary โดดเด่นแค่ตอนสำคัญ
- **Do** เคารพกฎ Clarity First พื้นที่ว่างระหว่างชุดข้อมูล (Whitespace) เป็นสิ่งสำคัญ
- **Do** เพิ่มเงาเล็กๆ (Hover Lift) เฉพาะบริเวณที่ผู้ใช้โต้ตอบได้ 

### Don't:
- **Don't** ทำหน้าจอดูแน่นทึบหรือยัดเยียดข้อมูลมากเกินไปในหน้าเดียว (Avoid cluttered UI)
- **Don't** ตกแต่งด้วยลูกเล่นกราฟิกหรือแอนิเมชันที่ไม่จำเป็น 
- **Don't** ใช้ปุ่ม Primary หลายปุ่มในแถบเดียวกัน ควรให้มีปุ่มหลักแค่หนึ่งปุ่ม นอกนั้นให้เป็น Secondary หรือ Ghost Button
