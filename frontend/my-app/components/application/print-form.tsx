// Paper replica of the SAB application form (119000064-FM-002 Rev.05), filled from a submitted form.
// Rendered only when printing (see `.sab` in globals.css); the on-screen view stays FormViewer.
import { OPTION_LABELS, computeAge, type ApplicationForm, type Row } from "@/lib/application-form"

type Props = { data: ApplicationForm; jobTitle?: string; docTypes: string[]; consentAt?: string }

const str = (v: unknown) => (v == null ? "" : String(v).trim())
const money = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-US") : "")
/** dd/mm/yyyy in พ.ศ., like a hand-filled form */
const day = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(v))
  if (m) return `${m[3]}/${m[2]}/${Number(m[1]) + 543}`
  const d = str(v) ? new Date(str(v)) : null
  return d && !isNaN(d.getTime()) ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear() + 543}` : ""
}
const monthYear = (v: unknown) => {
  const m = /^(\d{4})-(\d{2})$/.exec(str(v))
  return m ? `${m[2]}/${m[1]}` : str(v)
}
const join = (...parts: unknown[]) => parts.map(str).filter(Boolean).join(" ")

function Box({ on }: { on?: boolean }) {
  return <span className="sab-box">{on ? "✓" : ""}</span>
}

/** Thai label with the small English caption underneath */
function L({ th, en }: { th: React.ReactNode; en?: string }) {
  return (
    <span className="sab-l">
      {th}
      {en && <small>{en}</small>}
    </span>
  )
}

/** a bordered cell; `w` is its share of the row in % */
function C({ w, children, className = "" }: { w?: number; children?: React.ReactNode; className?: string }) {
  return <div className={`sab-c ${className}`} style={w ? { flex: `0 0 ${w}%` } : { flex: 1 }}>{children}</div>
}

function V({ children }: { children?: React.ReactNode }) {
  return <span className="sab-v">{children}</span>
}

function Opt({ on, th, en }: { on?: boolean; th: string; en?: string }) {
  return <span className="sab-opt"><Box on={on} /><L th={th} en={en} /></span>
}

function Head({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return <div className={`sab-head ${dark ? "sab-head-dark" : ""}`}>{children}</div>
}

function Footer({ page }: { page: number }) {
  return (
    <div className="sab-foot">
      <span />
      <span>PAGE {page} / 2</span>
      <span>119000064-FM-002 Rev.05</span>
    </div>
  )
}

const EDU_ROWS: { levels: string[]; th: string; en: string }[] = [
  { levels: ["primary"], th: "ประถมศึกษา", en: "ELEMENTARY" },
  { levels: ["lower_secondary"], th: "มัธยมศึกษาตอนต้น", en: "JUNIOR SECONDARY" },
  { levels: ["upper_secondary", "vocational_cert"], th: "มัธยมศึกษาตอนปลาย/ปวช.", en: "SENIOR SECONDARY / VOCATIONAL" },
  { levels: ["diploma"], th: "ปวส./อนุปริญญา", en: "DIPLOMA" },
  { levels: ["bachelor"], th: "ปริญญาตรี", en: "BACHELOR DEGREE" },
  { levels: ["master_or_higher"], th: "ปริญญาโท ขึ้นไป", en: "MASTER DEGREE OR HIGHER" },
]

export function PrintForm({ data: f, jobTitle, docTypes, consentAt }: Props) {
  const s = (k: string) => str(f[k])
  const has = (t: string) => docTypes.includes(t)
  const edu = (f.education as Row[] | undefined) ?? []
  const langs = (f.languages as Row[] | undefined) ?? []
  const english = langs.find((l) => /อังกฤษ|english/i.test(str(l.language)))
  const others = langs.filter((l) => l !== english)
  const comp = (f.computer_skills as Row[] | undefined) ?? []
  const lic = (f.driving_licenses as Row[] | undefined) ?? []
  const licNo = (t: string) => lic.filter((l) => l.type === t).map((l) => str(l.license_no) || "✓").join(", ")
  const job = (f.current_job as Row | undefined) ?? {}
  const records = (f.employment_records as Row[] | undefined) ?? []
  const age = computeAge(s("date_of_birth"))
  const income = ["salary_current", "allowance", "commission", "other_income"]
    .map((k) => job[k]).filter((v): v is number => typeof v === "number")
  const otherDocs = ["resume", "payslip", "other"].filter(has)
  const rating = (r: Row | undefined, k: string) => str(r?.[k])
  // skip the ปวส. row unless it was filled, like the paper form
  const eduRows = EDU_ROWS.filter((r) => r.levels[0] !== "diploma" || edu.some((e) => e.level === "diploma"))

  return (
    <div className="sab">
      {/* ───────────── PAGE 1 ───────────── */}
      <section className="sab-page">
        <div className="sab-top">
          <div className="sab-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" />
            <div className="sab-units">
              <span>สังกัด</span><Box /><span>PTG</span><Box /><span>PTC</span><Box /><span>PTGL</span>
              <span>Unit</span><Box /><span>PUN</span><Box /><span>GFA</span><Box on /><span>SAB</span>
            </div>
          </div>
          <div className="sab-title">
            <h1>แบบฟอร์มสมัครงาน</h1>
            <h2>APPLICATION FORM</h2>
          </div>
          <div className="sab-ids">
            <div><L th="รหัสพนักงาน" en="ID NO." /><span className="sab-idbox" /></div>
            <div><L th="ท่านสามารถเริ่มงานได้" en="STARTING DATE" /><span className="sab-idbox"><V>{day(f.available_start_date)}</V></span></div>
          </div>
        </div>

        <div className="sab-r">
          <C w={11}><L th="ตำแหน่งที่สมัคร" en="APPLYING FOR" /></C>
          <C w={24}><V>{jobTitle}</V></C>
          <C w={40}>
            <L th="กรณีปฏิบัติงานต่างจังหวัด :" />
            <div className="sab-opts">
              <Opt on={s("work_upcountry") === "sometimes"} th="บางครั้ง" />
              <Opt on={s("work_upcountry") === "anywhere"} th="ได้ทั่วประเทศ" />
              <Opt on={s("work_upcountry") === "region"} th="ภาค" />
              <span className="sab-line"><V>{s("work_upcountry_region")}</V></span>
            </div>
          </C>
          <C w={14}><L th="เงินเดือนที่ต้องการ :" en="SALARY REQUIRED" /></C>
          <C><V>{money(f.expected_salary)}</V></C>
        </div>

        <div className="sab-r">
          <C w={22}>
            <L th="ทราบข่าวการรับสมัครจาก :" en="What sources of media did you get from ?" />
            <V>{s("job_source") === "other" ? s("job_source_other") : s("job_source") !== "referral" ? (OPTION_LABELS.job_source?.[s("job_source")] ?? s("job_source")) : ""}</V>
          </C>
          <C w={42}>
            <div className="sab-opts sab-nowrap">
              <Opt on={s("job_source") === "referral"} th="บุคคลแนะนำ" />
              <span>(ชื่อ-สกุล)</span><span className="sab-line"><V>{s("referrer_name")}</V></span>
              <span>รหัส</span><span className="sab-line sab-short"><V>{s("referrer_code")}</V></span>
            </div>
          </C>
          <C>
            <div className="sab-opts sab-nowrap">
              <L th={<>สถานภาพ<br />ปัจจุบัน :</>} />
              <Opt on={s("current_status") === "unemployed"} th="ว่างงาน" en="UNEMPLOYED" />
              <Opt on={s("current_status") === "full_time"} th="มีงานประจำ" en="FULL TIME JOB" />
              <Opt on={s("current_status") === "part_time"} th="งานเสริม" en="PART TIME JOB" />
            </div>
          </C>
        </div>

        <div className="sab-r">
          <div className="sab-docs">
            <div className="sab-docs-l"><L th="หลักฐานประกอบการสมัครงาน :" en="(ฉบับสำเนา)" /></div>
            <div className="sab-docs-g">
              <Opt on={has("id_card")} th="บัตรประชาชน" />
              <Opt on={has("house_registration")} th="ทะเบียนบ้าน" />
              <Opt on={has("education")} th="หลักฐานการศึกษา / TRANSCRIPT" />
              <Opt on={has("marriage_certificate")} th="ทะเบียนสมรส (ถ้ามี)" />
              <Opt on={has("name_change")} th="หลักฐานการเปลี่ยนชื่อ-สกุล (ถ้ามี)" />
              <span className="sab-opt"><Box on={has("certificate")} /><span>หนังสือรับรอง<br />การอบรม</span><Box on={has("driving_license")} /><span>ใบขับขี่ /<br />ใบขับขี่ประเภท 4 (ถ้ามี)</span></span>
              <Opt on={has("work_certificate")} th="หนังสือรับรองการทำงาน (ถ้ามี)" />
              <Opt on={has("military")} th="หนังสือสำคัญ เกี่ยวกับทหาร สด.9 / สด.43 (ถ้ามี)" />
              <span className="sab-opt"><Box on={otherDocs.length > 0} /><span>อื่นๆ</span><span className="sab-line"><V>{otherDocs.length ? otherDocs.map((t) => ({ resume: "Resume", payslip: "สลิปเงินเดือน", other: "อื่นๆ" })[t]).join(", ") : ""}</V></span></span>
              <span className="sab-opt"><span>บัตรประกันสังคม</span><Box on={s("social_security") === "has"} /><span>มี</span></span>
              <Opt on={s("social_security") === "none_or_expired"} th="ไม่มี / หมดอายุแล้ว(ลาออกมาเกิน 6 เดือน)" />
              <span className="sab-opt"><span>ระบุ<br />โรงพยาบาล :</span><span className="sab-line"><V>{s("social_security_hospital")}</V></span></span>
            </div>
            <div className="sab-uniform">
              <div className="sab-uniform-l"><b>ชุดพนักงาน :</b><b>สำหรับ<br />เจ้าหน้าที่</b></div>
              <div className="sab-uniform-g">
                {["เสื้อ", "กางเกง"].map((k) => (
                  <div key={k} className="sab-sizes">
                    <span className="sab-red">{k}</span>
                    {["SS", "S", "M", "L", "XL", "2XL", "3XL", "อื่นๆ"].map((z) => <span key={z} className="sab-opt"><Box /><span className="sab-red">{z}</span></span>)}
                  </div>
                ))}
              </div>
              <div className="sab-uniform-m">
                <b>น้ำหนัก Weight :</b>
                <span><V>{str(f.weight_kg)}</V> kgs</span>
              </div>
              <div className="sab-uniform-m">
                <b>ส่วนสูง Height :</b>
                <span><V>{str(f.height_cm)}</V> cms</span>
              </div>
            </div>
          </div>
          <div className="sab-photo" />
        </div>

        <Head>ข้อมูลทั่วไป / PERSONAL INFORMATION</Head>
        <div className="sab-r">
          <C w={38}><L th="คำนำหน้า:" /> <V>{s("title_th")}</V> <span className="sab-gap" /><L th="ชื่อ :" /> <V>{s("first_name_th")}</V></C>
          <C w={30}><L th="นามสกุล :" /> <V>{s("last_name_th")}</V></C>
          <C w={14}><L th="ชื่อเล่น :" en="NICKNAME" /> <V>{s("nickname")}</V></C>
          <C><div className="sab-opts"><L th="เพศ :" en="GENDER" /><Opt on={s("gender") === "male"} th="ชาย" en="MALE" /><Opt on={s("gender") === "female"} th="หญิง" en="FEMALE" /></div></C>
        </div>
        <div className="sab-r">
          <C w={38}><L th="TITLE :" /> <V>{s("title_en")}</V> <span className="sab-gap" /><L th="NAME :" /> <V>{s("first_name_en")}</V></C>
          <C w={30}><L th="SURNAME :" /> <V>{s("last_name_en")}</V></C>
          <C w={14}><L th="อายุ :" en="AGE" /> <V>{age ?? ""}</V></C>
          <C><L th="กรุ๊ปเลือด :" en="BLOOD TYPE" /> <V>{s("blood_type")}</V></C>
        </div>
        <div className="sab-r">
          <C w={35}><L th="เลขบัตรประชาชน :" /> <V>{s("national_id")}</V></C>
          <C w={20}><L th="ออกที่ :" en="ISSUE AT" /> <V>{s("id_issued_at")}</V></C>
          <C w={13}><L th="จังหวัด :" en="PROVINCE" /> <V>{s("id_issue_province")}</V></C>
          <C w={14}><L th="วันออกบัตร :" en="ISSUE DATE" /> <V>{day(f.id_issue_date)}</V></C>
          <C><L th="วันบัตรหมดอายุ :" en="EXPIRED DATE" /> <V>{day(f.id_expiry_date)}</V></C>
        </div>
        <div className="sab-r">
          <C w={35}><L th="วัน-เดือน-ปีเกิด :" en="DATE OF BIRTH" /> <V>{day(f.date_of_birth)}</V></C>
          <C w={47}><L th="สถานที่เกิด (จังหวัด) :" en="PROVINCE OF BIRTH" /> <V>{s("birth_province")}</V></C>
          <C><L th="ศาสนา :" en="RELIGION" /> <V>{s("religion")}</V></C>
        </div>
        <div className="sab-r">
          <C w={24}><L th="สัญชาติ :" en="NATIONALITY" /> <V>{s("nationality")}</V></C>
          <C w={24}><L th="เชื้อชาติ :" en="RACE" /> <V>{s("race")}</V></C>
          <C>
            <div className="sab-opts">
              <L th="สถานภาพทางทหาร :" en="MILITARY STATUS" />
              <Opt on={s("military_status") === "completed"} th="ผ่านการเกณฑ์ทหารแล้ว" en="COMPLETED" />
              <Opt on={s("military_status") === "exempted"} th="ได้รับการยกเว้น" en="EXEMPTED" />
            </div>
          </C>
        </div>
        {([["father", "ชื่อ-สกุล บิดา :"], ["mother", "ชื่อ-สกุล มารดา :"]] as const).map(([p, th]) => (
          <PersonRow key={p} th={th} en={p === "father" ? "FATHER'S NAME" : "MOTHER'S NAME"}
            name={s(`${p}_name`)} status={s(`${p}_status`)} age={str(f[`${p}_age`])} job={s(`${p}_occupation`)} phone={s(`${p}_phone`)} />
        ))}
        <div className="sab-r">
          <C><L th="ที่อยู่ปัจจุบันของบิดา-มารดา :" /> <V>{join(f.parents_address, f.parents_subdistrict, f.parents_district, f.parents_province, f.parents_postcode)}</V></C>
        </div>
        <div className="sab-r">
          <C w={58}>
            <div className="sab-opts">
              <L th="สถานภาพการสมรส :" en="MARITAL STATUS" />
              <Opt on={s("marital_status") === "single"} th="โสด" en="SINGLE" />
              <Opt on={s("marital_status") === "married"} th="สมรส" en="MARRIED" />
              <Opt on={s("marital_status") === "divorced"} th="หย่าร้าง" en="DIVORCED" />
              <Opt on={s("marital_status") === "widowed"} th="หม้าย" en="WIDOWED" />
            </div>
          </C>
          <C w={24}><L th="จำนวนบุตร :" en="NUMBER OF CHILDREN" /> <V>{str(f.children_count)}</V></C>
          <C><L th="จำนวนพี่น้อง :" en="NUMBER OF SIBLINGS" /> <V>{str(f.siblings_count)}</V></C>
        </div>
        <PersonRow th="ชื่อคู่สมรส :" en="SPOUSE'S NAME" name={s("spouse_name")} status={s("spouse_status")}
          age={str(f.spouse_age)} job={s("spouse_occupation")} phone={s("spouse_phone")} />
        <div className="sab-r">
          <C>
            <div className="sab-opts sab-spread">
              <L th="พักอยู่กับ :" en="PRESENT ADDRESS" />
              <Opt on={s("residence_type") === "own"} th="บ้านพักตนเอง" en="OWN HOUSE" />
              <Opt on={s("residence_type") === "parents"} th="บ้านบิดา-มารดา" en="PARENT'S HOUSE" />
              <Opt on={s("residence_type") === "rental"} th="บ้านเช่า" en="RENTAL HOUSE" />
              <Opt on={s("residence_type") === "dormitory"} th="หอพัก" en="BOARDING HOUSE" />
              <Opt on={s("residence_type") === "other"} th="อื่นๆ" en="OTHERS" />
            </div>
          </C>
        </div>
        <div className="sab-r">
          <C><L th="ที่อยู่ปัจจุบัน :" en="PRESENT ADDRESS" /> <V>{join(f.present_address, f.present_subdistrict, f.present_district, f.present_province, f.present_postcode)}</V></C>
        </div>
        <div className="sab-r">
          <C w={18}><L th="โทรศัพท์บ้าน :" /> <V>{s("home_phone")}</V></C>
          <C w={24}><L th="โทรศัพท์มือถือ :" en="MOBILE PHONE" /> <V>{s("mobile_phone")}</V></C>
          <C w={20}><L th="LINE ID :" /> <V>{s("line_id")}</V></C>
          <C><L th="E-MAIL ADDRESS :" /> <V>{s("email")}</V></C>
        </div>
        <div className="sab-r">
          <C w={62}><L th="กรณีฉุกเฉินให้ติดต่อ (โปรดระบุ ชื่อ-สกุล) :" en="IN CASE OF EMERGENCY, PLEASE CONTACT" /> <V>{s("emergency_name")}</V></C>
          <C w={20}><L th="ความสัมพันธ์ :" en="RELATIONSHIP" /> <V>{s("emergency_relationship")}</V></C>
          <C><L th="โทรศัพท์:" en="TEL." /> <V>{s("emergency_phone")}</V></C>
        </div>

        <Head>ประวัติการศึกษา / EDUCATION BACKGROUND</Head>
        <table className="sab-t">
          <colgroup>
            <col style={{ width: "16%" }} /><col style={{ width: "22%" }} /><col style={{ width: "11%" }} />
            <col style={{ width: "6%" }} /><col style={{ width: "6%" }} /><col style={{ width: "10%" }} />
            <col style={{ width: "6%" }} /><col />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>ระดับการศึกษา<br />DEGREE LEVEL</th>
              <th rowSpan={2}>ชื่อสถาบันการศึกษา<br />INSTITUTE NAME</th>
              <th rowSpan={2}>จังหวัด<br />PROVINCE</th>
              <th colSpan={2}>ระยะเวลา <small>(PERIOD)</small></th>
              <th rowSpan={2}>วุฒิการศึกษา<br /><small>DEGREE / CERTIFICATE</small></th>
              <th rowSpan={2}>คะแนนเฉลี่ย<br />GPA</th>
              <th rowSpan={2}>คณะ / สาขา<br />FACULTY / MAJOR</th>
            </tr>
            <tr><th>ตั้งแต่<br /><small>(FROM)</small></th><th>ถึง<br /><small>(TO)</small></th></tr>
          </thead>
          <tbody>
            {eduRows.map((r) => {
              const rows = edu.filter((e) => r.levels.includes(str(e.level)))
              const col = (k: string) => rows.map((e) => str(e[k])).filter(Boolean).join(" / ")
              return (
                <tr key={r.th}>
                  <td className="sab-lvl"><L th={r.th} en={r.en} /></td>
                  <td><V>{col("institute")}</V></td><td><V>{col("province")}</V></td>
                  <td className="sab-mid"><V>{col("year_from")}</V></td><td className="sab-mid"><V>{col("year_to")}</V></td>
                  <td><V>{col("degree")}</V></td><td className="sab-mid"><V>{col("gpa")}</V></td><td><V>{col("major")}</V></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="sab-r">
          <C>
            <div className="sab-opts">
              <L th="สถานภาพการศึกษา :" en="EDUCATION STATUS" />
              <Opt on={s("education_status") === "not_studying"} th="ปัจจุบันไม่ได้ศึกษาต่อ" en="NO PLAN TO STUDY" />
              <Opt on={s("education_status") === "studying"} th="กำลังศึกษาต่อ สาขา" en="STUDY IN" />
              <span className="sab-line"><V>{s("studying_major")}</V></span>
              <L th="ชื่อสถาบันการศึกษา" en="INSTITUTE NAME" />
              <span className="sab-line"><V>{s("studying_institute")}</V></span>
            </div>
          </C>
        </div>
        <div className="sab-r">
          <C>
            <div className="sab-opts">
              <L th="กิจกรรมพิเศษ/ชมรม/งานโครงการก่อนสำเร็จการศึกษา :" />
              <span className="sab-line"><V>{s("activities")}</V></span>
              <L th="หน้าที่รับผิดชอบ" en="RESPONSIBLE FOR" />
              <span className="sab-line sab-short" />
            </div>
          </C>
        </div>
        <div className="sab-r">
          <C>
            <div className="sab-opts">
              <L th="การฝึกงาน / ฝึกอบรม ( INTERNSHIP COURSE/TRAINING ) :" />
              <span className="sab-line"><V>{s("training")}</V></span>
              <span className="sab-muted">ประวัติการฝึกอบรม โปรดระบุใน เอกสารประวัติส่วนตัว (RESUME)</span>
            </div>
          </C>
        </div>
        <Footer page={1} />
      </section>

      {/* ───────────── PAGE 2 ───────────── */}
      <section className="sab-page">
        <div className="sab-r sab-r-top">
          <div style={{ flex: "0 0 70%" }}><Head>ความชำนาญพิเศษ / SPECIAL SKILL</Head></div>
          <div style={{ flex: 1 }} />
        </div>
        <div className="sab-r">
          <C w={70} className="sab-mid">เกณฑ์การให้คะแนน / CRITERIA : 3 = ดีมาก (EXCELLENT), 2 = ดี (GOOD), 1 = พอใช้ (FAIR)</C>
          <C className="sab-headcell">ใบอนุญาตขับขี่ / DRIVING LICENSE</C>
        </div>
        <table className="sab-t">
          <colgroup>
            <col style={{ width: "16%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} />
            <col style={{ width: "9%" }} /><col style={{ width: "7%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} />
            <col style={{ width: "13%" }} /><col />
          </colgroup>
          <thead>
            <tr>
              <th>ภาษาต่างประเทศ<br />LANGUAGE ABILITY</th>
              <th>ฟัง<br /><small>LISTENING</small></th><th>พูด<br /><small>SPEAKING</small></th>
              <th>อ่าน<br /><small>READING</small></th><th>เขียน<br /><small>WRITING</small></th>
              <th>คอมพิวเตอร์<br /><small>COMPUTER SKILL</small></th><th>ความชำนาญ<br /><small>EXPERTISE</small></th>
              <th>คอมพิวเตอร์<br /><small>COMPUTER SKILL</small></th><th>ความชำนาญ<br /><small>EXPERTISE</small></th>
              <th>ประเภท<br />TYPE</th><th>เลขที่ใบอนุญาต<br />LICENSE NO.</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((i) => {
              const lang = i === 0 ? english : others[0]
              const c1 = comp[i], c2 = comp[i + 2]
              const [lt, lk] = i === 0 ? ["รถยนต์ / CAR", "car"] : ["รถจักรยานยนต์ / MOTORCYCLE", "motorcycle"]
              return (
                <tr key={i}>
                  <td>{i === 0 ? "ภาษาอังกฤษ / ENGLISH" : <>ภาษา : <V>{str(lang?.language)}</V></>}</td>
                  {["listening", "speaking", "reading", "writing"].map((k) => <td key={k} className="sab-mid"><V>{rating(lang, k)}</V></td>)}
                  <td className="sab-small">{i + 1}. <V>{str(c1?.name) || (i === 0 ? "MICROSOFT OFFICE" : "ERP")}</V></td>
                  <td className="sab-mid"><V>{str(c1?.level)}</V></td>
                  <td className="sab-small">{i + 3}. <V>{str(c2?.name)}</V></td>
                  <td className="sab-mid"><V>{str(c2?.level)}</V></td>
                  <td className="sab-small">{lt}</td>
                  <td><V>{licNo(lk)}</V></td>
                </tr>
              )
            })}
            {others.slice(1).map((lang, i) => (
              <tr key={`l${i}`}>
                <td>ภาษา : <V>{str(lang.language)}</V></td>
                {["listening", "speaking", "reading", "writing"].map((k) => <td key={k} className="sab-mid"><V>{rating(lang, k)}</V></td>)}
                <td colSpan={6} />
              </tr>
            ))}
            <tr>
              <td colSpan={5}><L th="ผลงานอื่นๆ :" en="OTHER" /> <V>{s("other_achievements")}</V></td>
              <td colSpan={3}><L th="งานอดิเรก และความสนใจ:" en="HOBBIES AND INTERESTS" /> <V>{s("hobbies")}</V></td>
              <td><L th="กีฬา :" en="SPORT" /> <V>{s("sports")}</V></td>
              <td className="sab-small">ประเภท 4 / TRUCK</td>
              <td><V>{licNo("truck")}</V></td>
            </tr>
          </tbody>
        </table>

        <Head>งานปัจจุบัน / CURRENT JOB</Head>
        <div className="sab-r">
          <C w={44}><L th="ชื่อสถานที่ทำงาน :" /> <V>{str(job.employer)}</V></C>
          <C w={24}><L th="ประเภทธุรกิจ :" en="BUSINESS TYPE" /> <V>{str(job.business_type)}</V></C>
          <C className="sab-mid"><L th="ค่าจ้างที่ได้รับ" en="SALARY" /></C>
        </div>
        <div className="sab-r">
          <C w={44}><L th="ที่อยู่ :" en="ADDRESS" /> <V>{str(job.address)}</V></C>
          <C w={24}><L th="โทรศัพท์ :" en="TEL." /> <V>{str(job.phone)}</V></C>
          <C w={16}><L th="เงินเดือนแรกเข้า :" /> <V>{money(job.salary_start)}</V></C>
          <C><L th="ค่าโทรศัพท์ :" /></C>
        </div>
        <div className="sab-r">
          <C w={18}><L th="วันที่เริ่มงาน :" en="STARTED DATE" /> <V>{day(job.start_date)}</V></C>
          <C w={26}><L th="ตำแหน่งแรกเข้า :" en="FIRST POSITION" /> <V>{str(job.first_position)}</V></C>
          <C w={24}><L th="ตำแหน่งปัจจุบัน :" en="CURRENT" /> <V>{str(job.current_position)}</V></C>
          <C w={16}><L th="เงินเดือนปัจจุบัน :" /> <V>{money(job.salary_current)}</V></C>
          <C><L th="ค่าคอมมิชชั่น :" /> <V>{money(job.commission)}</V></C>
        </div>
        <div className="sab-r">
          <C w={68}><L th="ลักษณะของงาน :" en="JOB DESCRIPTION" /> <V>{str(job.job_description)}</V></C>
          <C w={16}><L th="ค่าวิชาชีพ / น้ำมัน :" /> <V>{money(job.allowance)}</V></C>
          <C><L th="รายได้อื่นๆ :" /> <V>{money(job.other_income)}</V></C>
        </div>
        <div className="sab-r">
          <C w={68}><L th="เหตุผลที่ลาออก :" en="REASON FOR" /> <V>{str(job.reason_for_leaving)}</V></C>
          <C><L th="รายได้รวม/เดือน :" /> <V>{income.length ? money(income.reduce((a, b) => a + b, 0)) : ""}</V></C>
        </div>

        <Head>ประวัติการทำงาน ก่อนปัจจุบัน (ระบุการทำงานครั้งล่าสุดก่อน)<br />EMPLOYMENT RECORDS (BEGINNING WITH THE MOST RECENT JOB)</Head>
        <table className="sab-t">
          <colgroup>
            <col style={{ width: "10%" }} /><col style={{ width: "10%" }} /><col style={{ width: "30%" }} />
            <col style={{ width: "26%" }} /><col style={{ width: "9%" }} /><col />
          </colgroup>
          <thead>
            <tr>
              <th>เริ่ม (ด/ป)<br /><small>FROM (M/Y)</small></th><th>สิ้นสุด (ด/ป)<br /><small>TO (M/Y)</small></th>
              <th>ชื่อสถานที่ทำงาน<br /><small>EMPLOYER&apos;S NAME</small></th><th>ตำแหน่งงาน<br /><small>POSITION TITLE</small></th>
              <th>ค่าจ้างที่ได้รับ<br /><small>SALARY</small></th><th>เหตุผลที่ลาออก<br /><small>REASON FOR RESIGN</small></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(4, records.length) }, (_, i) => records[i] ?? {}).map((r, i) => (
              <tr key={i} className="sab-tall">
                <td className="sab-mid"><V>{monthYear(r.from)}</V></td><td className="sab-mid"><V>{monthYear(r.to)}</V></td>
                <td><V>{str(r.employer)}</V></td><td><V>{str(r.position)}</V></td>
                <td className="sab-mid"><V>{money(r.salary)}</V></td><td><V>{str(r.reason_for_leaving)}</V></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sab-spacer" />
        <div className="sab-qs">
          <Question title="ท่านเคยถูกจับกุมหรือต้องโทษในคดีทางอาญาหรือไม่ ?" a={["ไม่มี", f.criminal_record === false]} b={["มี", f.criminal_record === true]} detail={s("criminal_record_detail")} />
          <Question title="ปัจจุบันท่านมีสถานะเครดิตบูโรเป็นปกติหรือไม่ ?" a={["ปกติ", f.credit_bureau_normal === true]} b={["ไม่ปกติ", f.credit_bureau_normal === false]} detail={s("credit_bureau_detail")} detailLabel="โปรดระบุ :" />
          <Question title="ท่านมีโรคประจำตัวหรือไม่ ?" a={["ไม่มี", f.chronic_disease === false]} b={["มี", f.chronic_disease === true]} detail={s("chronic_disease_detail")} />
          <Question title="ท่านมีญาติ หรือบุคคลรู้จักในบริษัทนี้หรือไม่ ?" a={["ไม่มี", f.relatives_in_company === false]} b={["มี", f.relatives_in_company === true]} detail={s("relatives_detail")} />
        </div>

        <div className="sab-pdpa">
          <h3>หนังสือรับทราบ นโยบาย และคำชี้แจงการคุ้มครองข้อมูลส่วนบุคคล</h3>
          <h3>และยินยอมในการเก็บข้อมูลที่มีความอ่อนไหว เพื่อประกอบการสมัครงาน</h3>
          <p className="sab-indent">
            ตามที่ได้มีประกาศนโยบาย พร้อมทั้งคำชี้แจงการคุ้มครองข้อมูลส่วนบุคคล เพื่อให้เป็นไปตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
            บริษัท พีทีจี เอ็นเนอยี จำกัด (มหาชน) บริษัทย่อย หรือบริษัทในเครือ (&quot;กลุ่มบริษัท&quot;) ได้ให้ความสำคัญในการคุ้มครองข้อมูลส่วนบุคคลของท่าน ด้วยเหตุดังกล่าวจึงขอให้ท่าน
            ให้ความยินยอมแก่ กลุ่มบริษัท ในการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลของท่านต่อไป ซึ่งท่านสามารถเพิกถอนความยินยอมที่ได้ให้ไว้กับบริษัทได้ตลอดเวลา
            ที่อีเมลล์ dpo@pt.co.th ทั้งนี้ การเพิกถอนความยินยอมของท่านอาจส่งผลต่อการพิจารณาคัดเลือกคุณสมบัติและการพิจารณารับเข้าทำงานได้ ซึ่งข้าพเจ้าในฐานะผู้สมัครงาน
          </p>
          <ol>
            <li>รับทราบ และเข้าใจในนโยบายพร้อมคำชี้แจงการคุ้มครองส่วนบุคคล ที่กลุ่มบริษัทได้ประกาศไว้แล้วอย่างชัดเจน</li>
            <li>ยินยอมให้มีการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลเกี่ยวกับประวัติอาชญากรรมและข้อมูลสุขภาพเพื่อพิจารณาคัดกรองประวัติ ติดตามตรวจสอบ ในขั้นตอนการรับสมัคร และพิจารณาคัดเลือกการจ้างงาน</li>
            <li>ยินยอมให้มีการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลเชื้อชาติ และศาสนา เพื่อยืนยันตัวตนและให้โอกาสอย่างเท่าเทียม</li>
            <li>ยินยอมให้การเปิดเผยข้อมูลส่วนบุคคลที่มีความอ่อนไหวของข้าพเจ้าไปยัง บริษัทย่อย บริษัทในเครือ และบริษัทร่วมทุนของบริษัท พีทีจี เอ็นเนอยี จำกัด (มหาชน) เพื่อประโยชน์ในการสรรหาบุคลากรให้เข้ามาร่วมงานกับนิติบุคคลดังกล่าว</li>
          </ol>
          <p>ข้าพเจ้าในฐานะผู้สมัครงาน ขอรับรอง และยืนยันว่า ข้อมูลส่วนบุคคลของบุคคลอื่นใดที่ข้าพเจ้าได้กรอก และอ้างอิงไว้ในใบสมัครงานฉบับนี้</p>
          <ol>
            <li>บุคคลอื่นใดซึ่งเป็นเจ้าของข้อมูลส่วนบุคคลเหล่านั้นได้รับแจ้งจากข้าพเจ้าเกี่ยวกับการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของตน และได้เข้าใจรายละเอียดในเรื่องดังกล่าวเป็นอย่างดีแล้ว</li>
            <li>บุคคลซึ่งเป็นเจ้าของข้อมูลส่วนบุคคลเหล่านั้นได้ให้ความยินยอมแก่ข้าพเจ้า หรือข้าพเจ้า ได้อาศัยฐานทางกฎหมายอื่นที่เป็นข้อยกเว้นตามกฎหมายเพื่อเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลดังกล่าวอย่างถูกต้องแล้ว</li>
            <li>ข้าพเจ้าได้รับความยินยอม หรือมีอำนาจโดยชอบด้วยกฎหมายในการเปิดเผยข้อมูลส่วนบุคคลของบุคคลเหล่านั้นต่อกลุ่มบริษัท รวมถึงบริษัทร่วมทุนของ บริษัท พีทีจี เอ็นเนอยี จำกัด (มหาชน)</li>
            <li>กลุ่มบริษัท และบริษัทร่วมทุนของ บริษัท พีทีจี เอ็นเนอยี จำกัด (มหาชน) มีสิทธิโดยชอบด้วยกฎหมายในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของบุคคลเหล่านั้น ตามที่ข้าพเจ้าได้ให้ไว้ในใบสมัครงานฉบับนี้</li>
            <li>ข้อมูลที่ให้ไว้ในใบสมัครนี้เป็นความจริงทุกประการ ถ้าหลังจากที่บริษัทตกลงจ้างเข้าทำงานแล้วพบว่า ข้อความหรือเอกสารที่ประกอบการสมัครงานไม่เป็นความจริง บริษัทมีสิทธิที่จะบอกเลิกจ้างได้ โดยไม่ต้องจ่ายชดเชยใดๆทั้งสิ้น</li>
          </ol>
          <div className="sab-sign">
            <span style={{ flex: "0 0 70%" }}><L th="ลายมือชื่อ :" en="SIGNATURE" /> <V>{s("signature_name")}</V></span>
            <span><L th="วันที่ :" en="DATE" /> <V>{day(consentAt)}</V></span>
          </div>
        </div>
        <Footer page={2} />
      </section>
    </div>
  )
}

function PersonRow({ th, en, name, status, age, job, phone }: { th: string; en: string; name: string; status: string; age: string; job: string; phone: string }) {
  return (
    <div className="sab-r">
      <C w={34}><L th={th} en={en} /> <V>{name}</V></C>
      <C w={19}><div className="sab-opts"><Opt on={status === "alive"} th="มีชีวิตอยู่" en="ALIVE" /><Opt on={status === "deceased"} th="ถึงแก่กรรม" en="PASSED AWAY" /></div></C>
      <C w={9}><L th="อายุ :" en="AGE" /> <V>{age}</V></C>
      <C w={20}><L th="อาชีพ :" en="OCCUPATION" /> <V>{job}</V></C>
      <C><L th="โทรศัพท์:" en="TEL." /> <V>{phone}</V></C>
    </div>
  )
}

function Question({ title, a, b, detail, detailLabel = "ถ้ามี โปรดระบุ :" }: {
  title: string; a: [string, boolean]; b: [string, boolean]; detail: string; detailLabel?: string
}) {
  return (
    <div className="sab-q">
      <Head>{title}</Head>
      <div className="sab-opts sab-q-body">
        <Opt on={a[1]} th={a[0]} /><Opt on={b[1]} th={b[0]} />
        <span>{detailLabel}</span><span className="sab-line"><V>{detail}</V></span>
      </div>
    </div>
  )
}
