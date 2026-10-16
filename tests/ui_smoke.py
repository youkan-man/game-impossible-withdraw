#!/usr/bin/env python3
"""Playwright UI checks; --in-memory renders the bundle without navigation/network.

The in-memory option substitutes Storage because about:blank has no persistent
origin. Storage recovery and checksums are separately covered by Node tests.
"""
import argparse
import asyncio
import datetime as dt
import json
import os
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]

async def run(args):
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    subprocess.run(['python3', str(ROOT / 'tools/bundle.py')], check=True)
    html = (ROOT / 'dist/impossible-withdraw.html').read_text(encoding='utf-8')
    report = {'mode': 'in-memory HTML / Storage adapter' if args.in_memory else 'HTTP / real browser Storage', 'checks': [], 'screenshots': [], 'page_errors': []}
    def passed(label):
        report['checks'].append(label)
        print('PASS', label, flush=True)
    def fixture(js=''):
        source = 'const G=require("./game.js"),P=require("./save.js");const s=G.createState(Date.now());s.welcome=false;' + js + ';process.stdout.write(P.encode(s));'
        return subprocess.check_output(['node', '-e', source], cwd=ROOT, text=True)
    async with async_playwright() as pw:
        opts = {'headless': True}
        executable = args.chromium or os.environ.get('CHROMIUM_PATH')
        if executable:
            opts['executable_path'] = executable
        browser = await pw.chromium.launch(**opts)
        async def new_page(seed=None, width=1440, height=960, storage=True):
            page = await browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
            page.set_default_timeout(5000)
            page.on('pageerror', lambda e: report['page_errors'].append(str(e)))
            now = dt.datetime.now(dt.timezone.utc)
            await page.clock.install(time=now)
            await page.clock.pause_at(now + dt.timedelta(seconds=1))
            if args.in_memory:
                if storage:
                    await page.evaluate('''seed => {const m=new Map(); if(seed)m.set('impossible-withdraw.save.v1',seed); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}});}''', seed)
                await page.set_content(html, wait_until='load')
            else:
                if seed:
                    await page.add_init_script('localStorage.setItem("impossible-withdraw.save.v1",'+json.dumps(seed)+');')
                await page.goto(args.url, wait_until='load')
            return page
        async def shot(page, name):
            path = output / (name + '.png')
            await page.screenshot(path=str(path), animations='disabled')
            report['screenshots'].append(str(path))
        async def snapshot(page):
            return await page.evaluate('WithdrawSave.decode(localStorage.getItem(WithdrawSave.KEY))')
        async def click(page, action):
            await page.locator('[data-action="'+action+'"]').filter(visible=True).first.click()
        async def tab(page, view):
            await page.locator('.browser-tab[data-view="'+view+'"]').click()
        async def no_overflow(page):
            bad = await page.evaluate('''() => ({page:document.documentElement.scrollWidth>innerWidth, content:document.querySelector('.content-scroll').scrollWidth>document.querySelector('.content-scroll').clientWidth+1})''')
            assert not bad['page'] and not bad['content'], bad

        page = await new_page()
        await shot(page, '00-welcome')
        await click(page, 'start')
        await shot(page, '01-market-desktop')
        await no_overflow(page)
        await page.locator('[data-product="clock"] [data-action="buy"]').click()
        assert len((await snapshot(page))['inventory']) == 1
        await tab(page, 'store')
        await click(page, 'list')
        await shot(page, '02-store-desktop')
        await page.clock.fast_forward(13000)
        assert (await snapshot(page))['stats']['sold'] == 1
        passed('Manual purchase → list → timed sale → CC received')
        await tab(page, 'bots')
        await page.locator('[data-bot="lister"] [data-action="upgrade-bot"]').click()
        assert (await snapshot(page))['bots']['lister']['level'] == 1
        await shot(page, '03-bots-desktop')
        passed('Bot purchase and upgrade controls')
        await tab(page, 'withdraw')
        for n in range(1, 14):
            await shot(page, 'route-%02d' % n)
            await no_overflow(page)
            if n == 11:
                await click(page, 'verify-next')
                assert await page.locator('#page h1').inner_text() == '退会要請'
                for i in range(3):
                    await page.locator('[data-verify="'+str(i)+'"]').check()
                await click(page, 'verify-next')
            elif n < 13:
                await page.locator('.route-card [data-route="'+str(n+1)+'"]').click()
        passed('All 15 original route pages, including required confirmations')
        before = (await snapshot(page))['coins']
        await click(page, 'deposit')
        await shot(page, '04-deposit-confirmation')
        await click(page, 'enter')
        state = await snapshot(page)
        assert state['coins'] == before-500 and state['attempt']['deposit'] == 500
        await shot(page, '05-withdrawal-original-layout')
        assert 'デポジットを譲渡します' in await page.locator('#page').inner_text()
        assert '全財産' not in await page.locator('#page').inner_text()
        await page.clock.fast_forward(2200)
        state = await snapshot(page)
        assert state['attempt'] is None and state['stats']['lost'] == 500
        assert await page.locator('#modal-title').inner_text() == '退会できませんでした。'
        await shot(page, '06-failed-attempt')
        passed('Real two-second deadline, escrow deduction, deposit-only loss, result dialog')
        await click(page, 'return-store')
        await page.locator('.taskbar-tool[data-action="settings"]').click()
        await shot(page, 'modal-settings')
        async with page.expect_download() as download:
            await click(page, 'export')
        exported = output / 'exported-save.json'
        await (await download.value).save_as(exported)
        assert 'impossible-withdraw' in exported.read_text()
        await click(page, 'import')
        await page.locator('#import-file').set_input_files(exported)
        await page.clock.run_for(1)
        assert (await snapshot(page))['stats']['sold'] == 1
        passed('JSON save export and import')
        await page.locator('.taskbar-tool[data-action="settings"]').click()
        await click(page, 'reset-confirm')
        await shot(page, 'modal-reset-confirmation')
        await click(page, 'reset')
        assert (await snapshot(page))['stats']['sold'] == 1
        await click(page, 'dismiss')
        passed('Destructive reset requires the confirmation phrase')
        await click(page, 'journal')
        await shot(page, 'modal-journal')
        await click(page, 'dismiss')
        await page.locator('.right-rail [data-action="ledger"]').click()
        await shot(page, 'modal-ledger')
        await click(page, 'dismiss')
        await click(page, 'minimize')
        assert await page.locator('#browser').is_hidden()
        await page.locator('#restore-hint [data-action="restore"]').click()
        await click(page, 'maximize')
        assert 'maximized' in await page.locator('#browser').get_attribute('class')
        await click(page, 'maximize')
        passed('Mock desktop browser minimize, restore, maximize')
        await tab(page, 'market')
        await page.locator('[data-product="camera"]').click(button='right')
        await shot(page, 'modal-context-menu')
        await click(page, 'item-info')
        await shot(page, 'modal-item')
        await click(page, 'dismiss')
        passed('Product context menu and item detail')
        await page.close()

        # Developed shop fixture: this is test data, never a production cheat API.
        developed = fixture("s.coins=30000;s.stats.sold=50;s.stats.profit=18500;s.stats.revenue=39500;s.data=30;s.discovered=13;s.path=13;s.bots.clock.level=12;s.research.latch=1;for(const id of ['clock','camera','record','radio'])G.buy(s,id);G.listAll(s)")
        page = await new_page(developed)
        await tab(page, 'store')
        await shot(page, '07-developed-store')
        await tab(page, 'bots')
        await shot(page, '08-developed-bots')
        await tab(page, 'withdraw')
        await click(page, 'deposit')
        await click(page, 'enter')
        await click(page, 'lesson')
        await shot(page, 'modal-unlock-lesson')
        await click(page, 'unlock')
        for i in range(3):
            await page.locator('[data-check="'+str(i)+'"]').uncheck()
        assert (await snapshot(page))['attempt']['checks'] == [False, False, False]
        await page.clock.fast_forward(4200)
        assert await page.locator('#ad-trap').is_visible()
        await shot(page, '09-advertisement-trap')
        await click(page, 'fake-ad')
        assert await page.locator('#ad-trap').is_visible()
        await click(page, 'real-ad')
        assert await page.locator('#ad-trap').is_hidden()
        tiles = page.locator('.captcha-tile[aria-label^="抹茶"]')
        for i in range(await tiles.count()):
            await tiles.nth(i).click()
        await page.locator('#terms-scroll').evaluate('(el)=>el.scrollTop=el.scrollHeight')
        await page.clock.run_for(50)
        await click(page, 'terms')
        await page.locator('#real-submit').scroll_into_view_if_needed()
        await shot(page, '10-withdrawal-verification')
        passed('Locked checks, automatic recheck countermeasure, fake/real ad close, captcha, scroll-to-end terms')
        # Keyboard events exercise the same escape budget without hover timing.
        for _ in range(4):
            if await page.locator('#real-submit').count() == 0:
                break
            await page.locator('#real-submit').focus()
            await page.keyboard.press('Enter')
        assert (await snapshot(page))['stats']['breakthroughs'] == 1
        await shot(page, '11-regulation-revision')
        passed('Evasive submit works with keyboard; full form starts the next regulation cycle')
        await page.close()

        automated = fixture("s.coins=30000;s.discovered=13;s.path=13;s.bots.clock.level=5;s.bots.solver.level=4;s.bots.shield.level=3")
        page = await new_page(automated)
        await tab(page, 'withdraw')
        await click(page, 'deposit')
        await click(page, 'enter')
        await page.clock.fast_forward(14000)
        assert (await snapshot(page))['stats']['breakthroughs'] == 1
        passed('Form Bot, Clock Bot and Audit Bot complete the form together')
        await page.close()

        for width,height in [(390,844),(768,1024),(1920,1080)]:
            page = await new_page(developed,width,height)
            for view in ['market','store','bots','withdraw']:
                await tab(page,view)
                await no_overflow(page)
                await shot(page,f'{width}-{view}')
            await page.close()
        passed('390px, 768px and 1920px layouts: no document or content horizontal overflow')

        if args.in_memory:
            page = await new_page(storage=False)
            assert await page.locator('#save-warning').is_visible()
            assert await page.locator('#modal-title').inner_text() == '退会できませんでした。'
            await click(page, 'start')
            await page.locator('[data-product="clock"] [data-action="buy"]').click()
            assert await page.locator('.tab-badge').inner_text() == '1'
            passed('Storage-denied environment still plays in memory and displays a warning')
            await page.close()
        assert not report['page_errors'], report['page_errors']
        passed('No uncaught browser JavaScript exceptions')
        await browser.close()
    report['passed'] = True
    (output/'ui-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'passed':len(report['checks']),'screenshots':len(report['screenshots']),'errors':report['page_errors']},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--in-memory',action='store_true')
    parser.add_argument('--url',default='http://127.0.0.1:8080/')
    parser.add_argument('--chromium',default=None)
    parser.add_argument('--output',default=str(ROOT/'test-artifacts'))
    asyncio.run(run(parser.parse_args()))
