/**
 * Chapter 1's words, by beat id. Written for someone new to WordPress and to the web: a bold
 * lead-in, short sentences, every term explained where it first appears, analogies labelled as
 * analogies. Real WordPress names stay visible, as hover-card words (`<Hook>`).
 *
 * No facts are typed here. The request and its status come from the data; file:line, priorities
 * and listener names live in the boards, the cards and each act's "Under the hood". The hero's
 * words are on the page itself (page.tsx), so it has no entry here.
 */
import { Hook } from "@/components/story/Hook";
import type { BeatCopy } from "@/lib/story/beat-copy";
import type { StoryData } from "@/lib/story/facts";

export const CHAPTER_1_COPY: Readonly<Record<string, BeatCopy>> = {
  /* Stop 0 · Before WordPress */
  address: ({ request }: StoryData) => (
    <>
      <b>You type an address.</b> Your browser turns it into a request: a note asking for one page. Think of it as a
      train. The label above it shows its cargo:{" "}
      <code>
        {request.method} {request.path}
      </code>
      .
    </>
  ),
  server: ({ request }: StoryData) => (
    <>
      <b>It travels the internet to a web server,</b> an always-on computer running software like nginx or Apache. It
      has no file called <code>{request.path}</code>, so a rewrite rule forwards it to <Hook name="index.php" />.
    </>
  ),
  php: (
    <>
      <b>PHP runs the code.</b> It&apos;s the language WordPress is written in. WordPress builds your page fresh on
      every visit, unless a cache (a saved copy) answers first.
    </>
  ),
  database: (
    <>
      <b>Your content lives in a database.</b> Posts, pages, settings and users are kept there, in tables. On this map,
      the database is the depot.
    </>
  ),
  response: (
    <>
      <b>The finished page goes back, and your browser draws it.</b> It travels as HTML, the code web pages are made of.
      The part in the middle is WordPress. Let&apos;s ride it.
    </>
  ),

  /* Boarding · index.php to wp-settings.php */
  index: (
    <>
      <b>
        Think of <Hook name="index.php" /> as the front door.
      </b>{" "}
      It&apos;s tiny. It says &ldquo;use the theme&rdquo; (<code>WP_USE_THEMES</code>) and loads{" "}
      <Hook name="wp-blog-header.php" />.
    </>
  ),
  config: (
    <>
      <b>
        <Hook name="wp-blog-header.php" /> loads <Hook name="wp-load.php" />,
      </b>{" "}
      which finds <Hook name="wp-config.php" /> in its own folder or the one above. It holds your database login and the
      site&apos;s settings.
    </>
  ),
  settings: (
    <>
      <b>
        <Hook name="wp-config.php" /> hands over to <Hook name="wp-settings.php" />.
      </b>{" "}
      Early on, it loads the hook system, which lets plugins join in: <Hook name="plugin.php" /> and{" "}
      <Hook name="class-wp-hook.php" />. Then drop-ins, optional files that replace part of WordPress, such as its
      cache.
    </>
  ),
  feeders: (
    <>
      <b>Plugins and the theme board here.</b> Must-use (always-on) plugins, then WordPress announces{" "}
      <Hook name="muplugins_loaded" />. Your plugins, then <Hook name="plugins_loaded" />. Then{" "}
      <Hook name="setup_theme" />, the theme&apos;s <Hook name="functions.php" /> (child theme first) and{" "}
      <Hook name="after_setup_theme" />.
    </>
  ),

  /* The announcement · init */
  arrive: (
    <>
      <b>
        The train pulls into <Hook name="init" />.
      </b>{" "}
      Your plugins and theme are loaded, and WordPress has set up the current user, so it knows who&apos;s visiting.
    </>
  ),
  announce: (
    <>
      <b>WordPress makes an announcement.</b> Think of a town-hall bell: <Hook name="do_action" /> rings it for{" "}
      <Hook name="init" />, and every listener that signed up with <Hook name="add_action" /> answers.
    </>
  ),
  tickets: (
    <>
      <b>Listeners take turns, by ticket number.</b> The ticket is the priority. Lowest goes first; with the same
      number, first in line. Actions hand nothing back.
    </>
  ),
  loaded: (
    <>
      <b>
        Then <Hook name="wp_loaded" />: everything is loaded.
      </b>{" "}
      WordPress, your plugins and the theme are all set up and ready to answer you.
    </>
  ),

  /* Next stop */
  next: (
    <>
      <b>Next, WordPress works out what you asked for.</b> Its main routine, <code>WP::main()</code>, reads the address
      and fetches your post from the depot. Then a junction picks the template, and a filter workshop polishes the
      title.
    </>
  ),
};
