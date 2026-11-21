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
      which finds <Hook name="wp-config.php" /> in its own folder or the one above. It holds your database login and a
      few site-wide switches, such as <code>WP_DEBUG</code>.
    </>
  ),
  settings: (
    <>
      <b>
        <Hook name="wp-config.php" /> hands over to <Hook name="wp-settings.php" />.
      </b>{" "}
      Early on, it loads the hook system that lets plugins join in: <Hook name="plugin.php" /> and{" "}
      <Hook name="class-wp-hook.php" />. Along the way, drop-ins: optional files that swap out part of WordPress, like
      its cache.
    </>
  ),
  feeders: (
    <>
      <b>Plugins and the theme join here.</b> Must-use (always-on) plugins, then WordPress announces{" "}
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
      Your plugins and theme are loaded, and WordPress has checked who&apos;s visiting: a logged-in user, or a guest.
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

  /* Finding your post · WP::main() */
  parse: ({ request }: StoryData) => (
    <>
      <b>
        <code>WP::main()</code> reads the address.
      </b>{" "}
      Rewrite rules turn <code>{request.path}</code> into a question WordPress can answer, such as &ldquo;the post with
      this name&rdquo;. Then it announces <Hook name="parse_request" />.
    </>
  ),
  query: (
    <>
      <b>Next, a query.</b> <Hook name="WP_Query" /> turns that question into a database query. Just before it runs,
      WordPress announces <Hook name="pre_get_posts" />, so a plugin can still change what gets fetched.
    </>
  ),
  depot: (
    <>
      <b>The query goes to the depot.</b> The database sends your post back. The list of posts then passes through{" "}
      <Hook name="the_posts" />, a filter: plugins can change the list before anyone sees it.
    </>
  ),
  wp: (
    <>
      <b>WordPress knows what to show.</b> It sends the response headers, then announces <Hook name="wp" />: the address
      is read and the post fetched, and nothing has been drawn yet.
    </>
  ),

  /* The junction · template-loader.php */
  redirect: (
    <>
      <b>
        The junction starts with <Hook name="template_redirect" />.
      </b>{" "}
      Before any of the page is drawn, plugins get a last chance to send you somewhere else, such as from an old address
      to a new one.
    </>
  ),
  hierarchy: (
    <>
      <b>Which file draws a post?</b> At the <Hook name="template" /> junction, WordPress walks the template hierarchy
      from the most specific file to the most general, and takes the first one the theme has.
    </>
  ),
  include: (
    <>
      <b>
        The chosen file passes through <Hook name="template_include" />,
      </b>{" "}
      a filter, so a plugin can swap in a file of its own. Then WordPress loads it, and the drawing starts.
    </>
  ),

  /* The workshop · drawing the page */
  blocks: (
    <>
      <b>The template runs, block by block.</b> A block theme draws its blocks before anything else, so each can ask for
      the styles and scripts it needs. The post&apos;s title and its content are blocks too.
    </>
  ),
  filter: (
    <>
      <b>Every title passes through a filter.</b> <Hook name="apply_filters" /> hands it to each function signed up on{" "}
      <Hook name="the_title" /> with <Hook name="add_filter" />. Each may change it, and must hand it back.
    </>
  ),
  content: (
    <>
      <b>The post&apos;s content takes a longer line.</b> <Hook name="the_content" /> runs a chain of filters in
      priority order: blocks become HTML, straight quotes turn curly, shortcodes run.
    </>
  ),
  assemble: (
    <>
      <b>Then the page is put together.</b> <Hook name="wp_head" /> prints what the blocks asked for into the
      page&apos;s head, and <Hook name="wp_footer" /> adds the scripts held back for the end.
    </>
  ),

  /* Back to your browser */
  sent: ({ status }: StoryData) => (
    <>
      <b>The page goes back to your browser.</b> It arrives as HTML, with the status code {status}. Your browser draws
      it, and fetches the styles, scripts and images it names.
    </>
  ),
  shutdown: (
    <>
      <b>
        Lights out: <Hook name="shutdown" />.
      </b>{" "}
      The very last announcement, as PHP finishes. Everything WordPress set up for this visit is forgotten; the next
      visit starts again at the front door.
    </>
  ),
  again: (
    <>
      <b>That was one visit.</b> Every page view rides this whole line, firing hundreds of hooks on the way.{" "}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain link keeps next/link's runtime (~3 KB gz) out of the route's JS budget */}
      <a href="/map">See every one of them on the map</a>.
    </>
  ),
};
