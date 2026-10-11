import json, random, os, sys
sys.stdout.reconfigure(encoding="utf-8")
random.seed(11)
WEB = r"C:\Users\24678\Documents\Default Project\cet4_web"
raw = json.load(open(r"C:\dev\downloads\voa_raw.json", encoding="utf-8"))
byid = {x["id"].replace(".mp3",""): x for x in raw}

Q = {
 "voa-01": [
   ["What did the Wright brothers prove was possible?", "flight without gas-filled balloons", ["traveling to the moon", "building a printing machine", "crossing the Atlantic by ship"], "他们证明了不用充气气球也能飞行。"],
   ["Where did the Wright brothers test their flying ideas?", "near Kitty Hawk, North Carolina", ["in Dayton, Ohio", "in Indiana", "in New York City"], "他们在北卡罗来纳的 Kitty Hawk 测试。"],
   ["By the autumn of 1903, what had the brothers built?", "an airplane powered by a gasoline engine", ["a gas-filled balloon", "a toy helicopter", "a bicycle"], "1903 年秋他们造出汽油发动机飞机。"]],
 "voa-02": [
   ["What is the estimated chance that asteroid 2024 YR4 hits Earth in 2032?", "3.1 percent", ["31 percent", "0.31 percent", "13 percent"], "NASA 估计约 3.1%。"],
   ["What does ESA official Richard Moissl advise people to do?", "not to panic", ["to move away", "to build shelters", "to stop watching the sky"], "他劝人们不要恐慌。"],
   ["According to scientists, what will happen to the odds over time?", "they will likely drop to zero", ["they will rise forever", "they will stay the same", "they will double each year"], "数据增多后概率最终会降到零。"]],
 "voa-03": [
   ["What is a total lunar eclipse also called?", "a blood moon", ["a blue moon", "a harvest moon", "a solar flare"], "月全食也叫 blood moon。"],
   ["Why does the moon look reddish during a total lunar eclipse?", "sunlight passes through Earth's atmosphere", ["the moon is on fire", "light comes from Mars", "the moon is made of copper"], "阳光穿过地球大气层使其变红。"],
   ["How often do lunar and solar eclipses happen each year, according to NASA?", "between four and seven times", ["only once", "every day", "never"], "NASA 说每年 4-7 次。"]],
 "voa-04": [
   ["According to the study, when will the next ice age likely begin?", "in about 11,000 years", ["in 100 years", "next year", "in 100,000 years"], "研究说约 1.1 万年后。"],
   ["Which scientist developed a theory about climate cycles about 100 years ago?", "Milutin Milankovitch", ["Robert Darnell", "Liza Finestack", "Robert Goddard"], "Milankovitch 提出该理论。"],
   ["Which three motions of the Earth affect climate cycles?", "the orbit's shape, the tilt and the wobble", ["speed, weight and size", "color, heat and light", "wind, rain and snow"], "轨道形状、倾角与章动。"]],
 "voa-05": [
   ["Which spacecraft first landed on the moon in 1966?", "Luna 9", ["Surveyor 1", "Apollo 11", "Blue Ghost"], "苏联 Luna 9 首次软着陆。"],
   ["What was Luna 9 the first to send from the moon's surface to Earth?", "photographic data", ["soil samples", "astronauts", "a rover"], "它首次传回月表照片数据。"],
   ["How many robotic spacecraft did the US send to prepare for the Apollo missions?", "seven", ["two", "nine", "five"], "NASA 的 Surveyor 系列共七艘。"]],
 "voa-06": [
   ["According to scientists, what did the new speaking ability help early humans do?", "survive", ["fly", "farm", "sleep longer"], "语言能力有助于人类生存。"],
   ["In which journal was the study published?", "Nature Communications", ["Science", "The Associated Press", "Nature"], "论文发表在 Nature Communications。"],
   ["What is the name of the protein studied by Dr. Darnell's lab?", "NOVA1", ["ferrihydrite", "hematite", "NOVA2"], "研究的蛋白叫 NOVA1。"]],
 "voa-07": [
   ["Which company built the Blue Ghost lander?", "Firefly Aerospace", ["SpaceX", "NASA", "Blue Origin"], "由 Firefly Aerospace 建造。"],
   ["Where did Blue Ghost land on the moon?", "Mare Crisium, on the near side", ["the far side of the moon", "Mars", "near Kitty Hawk"], "它落在近侧 Mare Crisium。"],
   ["What made Firefly's landing special?", "first private company to land on the moon without crashing", ["first to send humans", "the cheapest landing ever", "the fastest landing ever"], "首家无重大事故登月的私营公司。"]],
 "voa-08": [
   ["Which mineral may give Mars its red color, according to new data?", "ferrihydrite", ["hematite", "NOVA1", "copper"], "新数据指认 ferrihydrite。"],
   ["What does finding ferrihydrite suggest about Mars?", "it may have held a large supply of liquid water", ["it has life", "it is very hot", "it has no water at all"], "说明火星过去可能有大量液态水。"],
   ["What did past studies suggest caused Mars's red color?", "hematite", ["water", "iron", "NOVA1"], "过去认为是赤铁矿 hematite。"]],
 "voa-09": [
   ["Where was the wooden circle discovered?", "in Aars, Denmark", ["in England", "in Scotland", "in Germany"], "在丹麦 Aars 发现。"],
   ["How many wood pieces formed the circle?", "45", ["30", "15", "300"], "共 45 根木桩。"],
   ["The circle is compared to which famous structure?", "Stonehenge in Britain", ["the Eiffel Tower", "the Great Wall", "the pyramids"], "被比作英国巨石阵。"]],
 "voa-10": [
   ["What happened at the end of February?", "a parade of planets in the evening sky", ["a lunar eclipse", "an asteroid strike", "a rocket launch"], "二月末出现行星连珠。"],
   ["How do the planets appear in the sky?", "on the same side of the sun in the evening sky", ["in a perfect straight line", "only at dawn", "in the daytime"], "它们同处太阳同侧、傍晚可见。"],
   ["How often does a parade of four or five visible planets happen?", "every few years", ["every day", "once a century", "never"], "NASA 说几年一次。"]],
 "voa-11": [
   ["What is Toyota's Woven City used for?", "testing robotics, AI and autonomous vehicles", ["selling cars", "a shopping mall", "a theme park"], "用于测试机器人/AI/自动驾驶。"],
   ["Where is Woven City located?", "near Susono, Japan", ["in Tokyo", "in the United States", "in China"], "位于日本 Susono 附近。"],
   ["What does Toyota call Woven City?", "a 'Living Laboratory'", ["a 'smart city'", "a 'robot factory'", "a 'test track'"], "丰田称其为 Living Laboratory。"]],
 "voa-12": [
   ["What does NASA call Robert Goddard?", "the father of modern rocket propulsion", ["the first pilot", "the father of astronomy", "the inventor of the car"], "NASA 称其为现代火箭推进之父。"],
   ["What did Goddard successfully launch in 1926?", "the world's first liquid-fuel rocket", ["a gas-filled balloon", "a satellite", "a lunar lander"], "1926 年发射首枚液体燃料火箭。"],
   ["What kind of fuel did his early rockets use?", "solid fuels", ["gasoline only", "solar power", "coal"], "早期火箭用固体燃料。"]],
}

out = []
for cid, qs in Q.items():
    src = byid.get(cid)
    if not src: continue
    questions = []
    for stem, correct, distractors, expl in qs:
        opts = [correct] + distractors
        random.shuffle(opts)
        questions.append({"stem": stem, "options": opts, "answer": opts.index(correct), "explanation": expl})
    out.append({"id": cid, "type": "news", "theme": src["title"], "audio": src["audio"], "transcript": src["transcript"], "questions": questions})

open(os.path.join(WEB, "data", "voa.js"), "w", encoding="utf-8").write("window.CET4_VOA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("voa.js clips", len(out), "questions", sum(len(c["questions"]) for c in out), "KB", round(os.path.getsize(os.path.join(WEB, "data", "voa.js")) / 1024, 1))
