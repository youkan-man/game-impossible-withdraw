#!/usr/bin/env python3
"""Layered withdrawal browser tests. Fixtures are built through game APIs, not a production cheat hook.
Use --in-memory only when Chromium navigation is blocked; that mode substitutes Storage.
"""
import argparse
import asyncio
import datetime as dt
import json
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]

async def run(args):
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    subprocess.run(['python3',str(ROOT/'tools/bundle.py')],check=True)
    html=(ROOT/'dist/impossible-withdraw.html').read_text()
    report={'mode':'in-memory HTML / Storage adapter' if args.in_memory else 'HTTP browser / origin Storage','checks':[],'screenshots':[],'errors':[]}
    def passed(label):report['checks'].append(label);print('PASS',label,flush=True)
    def fixture(stage=1,extra=''):
        return subprocess.check_output(['node','-e',f"const {{reach}}=require('./tests/labyrinth-fixture.cjs');const s=reach({stage});{extra};process.stdout.write(require('./save').encode(s));"],cwd=ROOT,text=True)
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path=args.chromium)
        async def page_for(stage=1,extra='',width=1440,height=1000,override=None):
            p=await browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
            p.set_default_timeout(4000)
            p.on('pageerror',lambda e:report['errors'].append(str(e)))
            now=dt.datetime.now(dt.timezone.utc)
            await p.clock.install(time=now);await p.clock.pause_at(now+dt.timedelta(seconds=1))
            seed=override or fixture(stage,extra)
            if args.in_memory:
                await p.evaluate('''seed=>{const m=new Map([['impossible-withdraw.save.v1',seed]]);Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}});}''',seed)
                await p.set_content(html,wait_until='load')
            else:
                await p.add_init_script('if(!sessionStorage.layerFixture){localStorage.setItem("impossible-withdraw.save.v1",'+json.dumps(seed)+');sessionStorage.layerFixture="1";}')
                await p.goto(args.url,wait_until='load')
            return p
        async def shot(p,name):
            path=out/(name+'.png');
            if str(path) in report['screenshots']:path=out/(name+'-'+str(len(report['screenshots']))+'.png')
            await p.screenshot(path=str(path),animations='disabled');report['screenshots'].append(str(path))
        async def click(p,op,value=None):
            selector='[data-action="lab"][data-op="'+op+'"]'
            if value is not None:selector+='[data-value="'+value+'"]'
            await p.locator(selector).filter(visible=True).first.click()
        async def normal(p,action):await p.locator('[data-action="'+action+'"]').filter(visible=True).first.click()
        async def state(p):return await p.evaluate('WithdrawSave.decode(localStorage.getItem(WithdrawSave.KEY))')
        async def layer(p,number):assert await p.locator('.lab-stage.current span').inner_text()==str(number+1).zfill(2)
        async def original(p):
            await normal(p,'lesson');await normal(p,'unlock')
            for i in range(3):await p.locator('[data-check="'+str(i)+'"]').uncheck()
            for tile in await p.locator('.captcha-tile[aria-label^="抹茶"]').all():await tile.click()
            await p.locator('#terms-scroll').evaluate('el=>el.scrollTop=el.scrollHeight');await p.clock.run_for(30)
            await normal(p,'terms')
            for _ in range(6):
                if not await p.locator('#real-submit').count():break
                await p.locator('#real-submit').focus();await p.keyboard.press('Enter')
            await layer(p,1)
        async def seals(p):
            text=await p.locator('.lab-order strong').inner_text()
            for value in [x.strip() for x in text.split('→')]:await click(p,'seal',value)
            await layer(p,2)
        async def identity(p):
            await click(p,'otp-send');await normal(p,'lab-mail');await shot(p,'mail-latest-and-bait')
            code=await p.locator('.lab-mail.latest .lab-mail-code').inner_text()
            await normal(p,'dismiss');await p.locator('#lab-otp').fill(code);await click(p,'otp-verify');await layer(p,3)
        async def offices(p):
            for _ in range(3):
                doc=await p.locator('.lab-document strong').inner_text()
                await p.locator('#lab-document').select_option(doc)
                b=p.locator('.lab-department:not(.approved) [data-op="stamp"]').first
                await b.click()
            await layer(p,4)
        async def answers(p):
            while await p.locator('[data-op="answer"]').count():await click(p,'answer','leave')
            await layer(p,5)
        async def sign(p):
            await click(p,'terms-import')
            for i in range(3):await p.locator('[data-lab-renewal="'+str(i)+'"]').uncheck()
            word=await p.locator('.lab-document strong').inner_text();await p.locator('#lab-signature').fill(word)
            await click(p,'sign');await layer(p,6)
        async def queue(p):
            await click(p,'ticket');await p.clock.fast_forward(3100)
            assert 'OPEN' in await p.locator('#queue-window-label').inner_text()
            await click(p,'dispatch');await layer(p,7)
        async def final(p,keyboard=True):
            await click(p,'details');await p.locator('#lab-final-renewal').uncheck()
            await p.locator('#lab-hold').scroll_into_view_if_needed()
            await shot(p,'final-real-dispatch')
            if keyboard:
                await p.locator('#lab-hold').focus();await p.keyboard.down('Enter')
                await p.clock.fast_forward(1600);await p.keyboard.up('Enter')
            else:
                b=await p.locator('#lab-hold').bounding_box();await p.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);await p.mouse.down()
                await p.clock.fast_forward(1600);await p.mouse.up()
            assert (await state(p))['stats']['breakthroughs']==1
            assert '受付完了' in await p.locator('#modal-title').inner_text()
        async def no_overflow(p):
            problems=await p.evaluate('''()=>[document.documentElement,document.querySelector('.content-scroll')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className||e.tagName)''')
            assert not problems,problems

        # Complete the eight gates through visible controls, including actual keyboard holding.
        p=await page_for(0)
        await shot(p,'layer-01-front');await original(p);passed('Original red/gray withdrawal page leads into the inner locks')
        await shot(p,'layer-02-seals');await seals(p);passed('Manual sequential padlock release')
        await shot(p,'layer-03-identity');await identity(p);passed('Read newest game-inbox code and manually verify identity')
        await shot(p,'layer-04-offices');await offices(p);passed('Choose current original and obtain three dependent department stamps')
        await shot(p,'layer-05-negations');await answers(p);passed('Every nested cancellation question must be answered correctly')
        await shot(p,'layer-06-signature');await sign(p);passed('Import current rules, remove all three renewals, match signature nonce')
        await shot(p,'layer-07-queue');await queue(p);passed('Wait for both queue position and opening hours')
        await shot(p,'layer-08-false-completion');await final(p);await shot(p,'true-result-regulation-revised')
        assert (await state(p))['coins']==99900
        passed('All eight gates completed manually; one escrow settled; next regulation entered')
        await p.close()

        p=await page_for(1)
        order=[t.strip() for t in (await p.locator('.lab-order strong').inner_text()).split('→')]
        await click(p,'seal',order[0]);await click(p,'seal',order[2]);assert await p.locator('.lab-seal.open').count()==0
        await click(p,'seal',order[0]);await p.clock.fast_forward(3600);assert await p.locator('.lab-seal.open').count()==0
        await click(p,'seal',order[0]);await click(p,'bulk');assert await p.locator('.lab-seal.open').count()==0
        await shot(p,'trap-seals-relocked');passed('Wrong order, spring timer and bulk-unlock bait each relock the seals')
        await p.close()

        p=await page_for(2)
        await click(p,'otp-send');await normal(p,'lab-mail');code=await p.locator('.lab-mail.latest .lab-mail-code').inner_text();await normal(p,'dismiss')
        await click(p,'otp-send');await p.locator('#lab-otp').fill(code);await click(p,'otp-verify');await layer(p,2)
        await normal(p,'lab-mail');await shot(p,'trap-resend-invalidates-old-mail');fresh=await p.locator('.lab-mail.latest .lab-mail-code').inner_text();await normal(p,'dismiss')
        await p.clock.fast_forward(7100);await p.locator('#lab-otp').fill(fresh);await click(p,'otp-verify');await layer(p,2)
        assert '期限切れ' in await p.locator('#lab-event-text').inner_text()
        await normal(p,'lab-mail');await click(p,'mail-bait');await normal(p,'dismiss');await layer(p,2)
        assert (await state(p))['attempt']['labyrinth']['identity']['code']==''
        passed('Resent/stale/expired codes and marketing-mail approval never authenticate')
        await p.close()

        p=await page_for(3)
        await p.locator('.lab-department [data-op="stamp"]').first.click();await layer(p,2)
        await identity(p);await offices(p);before=(await state(p))['attempt']['remaining']
        await click(p,'answer','stay');await layer(p,3)
        await offices(p);after=await state(p)
        assert after['attempt']['remaining']<before
        assert after['stats']['gates']==4
        passed('Stale document and misleading confirmation cause real rollbacks; repeats do not farm gate rewards')
        await shot(p,'trap-rollback-no-repeat-reward');await p.close()

        p=await page_for(3,'s.research.notarize=1;')
        await click(p,'express');await layer(p,3);assert '第4層' in await p.locator('#lab-event-text').inner_text()
        passed('Notarized originals prevent returning to an earlier gate')
        await p.close()

        p=await page_for(5)
        await click(p,'terms-import')
        for i in range(3):await p.locator('[data-lab-renewal="'+str(i)+'"]').uncheck()
        old=await p.locator('.lab-version-row h3').inner_text()
        await p.clock.fast_forward(6200)
        assert await p.locator('.lab-version-row h3').inner_text()!=old
        assert await p.locator('[data-lab-renewal]:checked').count()==3
        await click(p,'sign');await layer(p,5);await shot(p,'trap-policy-revision')
        passed('Live policy revision restores opt-ins and invalidates the signature in the actual UI')
        await p.close()

        p=await page_for(5,'s.research.freeze=1;')
        old=await p.locator('.lab-version-row h3').inner_text();await p.clock.fast_forward(8000)
        assert await p.locator('.lab-version-row h3').inner_text()==old
        assert await p.locator('#terms-countdown').inner_text()=='ピン留め中'
        await sign(p);passed('Rule pinning gives the player time to sign without automatic replacement');await p.close()

        p=await page_for(6)
        await click(p,'dispatch');await layer(p,6)
        await click(p,'ticket');await p.clock.fast_forward(1100);await click(p,'ticket')
        assert (await state(p))['attempt']['labyrinth']['queue']['duplicates']==1
        await p.locator('.addressbar [data-action="refresh"]').click();assert (await state(p))['attempt']['labyrinth']['queue']['ticket']==False
        await click(p,'ticket');await p.clock.fast_forward(5100)
        assert 'CLOSED' in await p.locator('#queue-window-label').inner_text()
        await click(p,'dispatch');await layer(p,6);await shot(p,'trap-closed-service-window')
        await p.clock.fast_forward(2100);await click(p,'dispatch');await layer(p,7)
        passed('Repeated request resets the queue; in-game reload destroys the ticket; closed window rejects dispatch')
        await p.close()

        p=await page_for(7)
        await click(p,'fake-finish');assert (await state(p))['stats']['breakthroughs']==0
        assert (await state(p))['attempt'] is None
        await shot(p,'trap-false-completion-loss');passed('Fake completion button terminates the attempt instead of completing withdrawal');await p.close()

        p=await page_for(7)
        await click(p,'details');await p.locator('#lab-final-renewal').uncheck()
        await p.locator('#lab-hold').focus();await p.keyboard.down(' ');await p.clock.fast_forward(600);await p.keyboard.up(' ')
        assert (await state(p))['stats']['breakthroughs']==0
        assert (await state(p))['attempt']['labyrinth']['final']['held']==0
        # Blur is a real focus interruption, not a simulated successful click.
        await p.locator('#lab-hold').focus();await p.keyboard.down('Enter');await p.clock.fast_forward(400)
        await p.locator('.browser-tab[data-view="store"]').focus();await p.keyboard.up('Enter');await p.clock.fast_forward(1800)
        assert (await state(p))['stats']['breakthroughs']==0
        passed('Short release and focus loss cancel held submission; button clicks alone do not complete it')
        await final(p,keyboard=False);passed('Pointer capture supports genuine uninterrupted long-press submission');await p.close()

        p=await page_for(7)
        await click(p,'details');await p.locator('#lab-final-renewal').uncheck()
        await p.locator('#lab-hold').focus();await p.keyboard.down('Enter');await p.clock.fast_forward(500)
        await p.locator('.browser-tab[data-view="store"]').click();await p.keyboard.up('Enter');await p.clock.fast_forward(1500)
        assert (await state(p))['stats']['breakthroughs']==0
        await p.locator('.browser-tab[data-view="withdraw"]').click();assert (await state(p))['attempt']['labyrinth']['final']['holding']==False
        passed('Switching in-game tabs stops human hold while the global withdrawal deadline keeps running')
        await p.close()

        p=await page_for(1,'s.bots.solver.level=12;s.bots.shield.level=9;')
        await p.clock.fast_forward(35000);assert (await state(p))['stats']['breakthroughs']==1
        passed('Solver and Audit bots complete the seven new gates with no manual input');await p.close()

        # Restore saved bytes into a fresh JS runtime. set_content alone is NOT a reload: it retains old listeners.
        if args.in_memory:
            p=await page_for(2);await click(p,'otp-send');before=await state(p)
            encoded=await p.evaluate('localStorage.getItem(WithdrawSave.KEY)');await p.close()
            p=await page_for(override=encoded);assert (await state(p))['attempt']['labyrinth']['identity']['code']==before['attempt']['labyrinth']['identity']['code']
            await normal(p,'lab-mail');code=await p.locator('.lab-mail.latest .lab-mail-code').inner_text();await normal(p,'dismiss');await p.locator('#lab-otp').fill(code);await click(p,'otp-verify');await layer(p,3)
            passed('Saved in-flight code and layer restore in a fresh runtime without a second deposit');await p.close()

        for width,height in [(390,844),(768,1024),(1920,1080)]:
            for stage in range(1,8):
                p=await page_for(stage,width=width,height=height)
                if stage==7:await click(p,'details')
                await no_overflow(p);await shot(p,f'{width}-layer-{stage+1:02}')
                if stage==7:
                    await p.locator('#lab-hold').scroll_into_view_if_needed();await shot(p,f'{width}-final-controls');await no_overflow(p)
                await p.close()
        passed('Every new gate at 390 / 768 / 1920px: no horizontal overflow, all controls reachable')
        assert not report['errors'],report['errors'];passed('No uncaught JavaScript errors in layered screens or interactions')
        await browser.close()
    report['passed']=True;(out/'layered-ui-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'passed':len(report['checks']),'screenshots':len(report['screenshots']),'errors':report['errors']}),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--in-memory',action='store_true')
    parser.add_argument('--url',default='http://127.0.0.1:8080/')
    parser.add_argument('--chromium',default=None)
    parser.add_argument('--output',default=str(ROOT/'test-artifacts/layers'))
    asyncio.run(run(parser.parse_args()))
