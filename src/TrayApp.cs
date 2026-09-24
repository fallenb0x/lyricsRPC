using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Threading;

namespace LyricsTray
{
    static class Program
    {
        private static NotifyIcon notifyIcon;
        private static Bitmap _iconBmp;

        [DllImport("user32.dll")]
        private static extern bool DestroyIcon(IntPtr hIcon);

        private const string ICON_PNG_B64 =
            "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8" +
            "YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAABPsSURBVHhe7VoJdJTluf4mO0kIEIQAshu2gLIIZJmZZBKQ" +
            "RWQNZp+EchCBQMi+QBKysKkcFNqiFttacanWjdpry5Vqr20trVdrr2IrSzITlrAJIoiZf97n8573++cf" +
            "hpEiYNt7bk/ec94zk8m/Pc/37v8nRKd0Sqd0Sqd0Sqd0Sqd0ys1KjBBinBAiUQgxUggR4n/Av6Mw4GYh" +
            "xD4hxHkhxFcelUKIw0KIB4UQPf1P+neQVCHEf/gAvpYyEWP8L/D/VfoIIXb5AjRFCdn7ngjc8UA/THll" +
            "DGbuGQ/brjHomxYNjyXwcUeEEL39L3YTEiaE6CKECPT/x79CbB4gCnhIfxMmbhiMooPz8SPZjJfkDhR+" +
            "Povyzpip4EIq7BdSEbuory8Jz/hf8BrCQBOEEKuEEE8IId4SQnwshHAKIdqEEAeEEL8XQjwthCjzxJ1g" +
            "/4v8I+UeIYTmAYJJJYPw4OkVeFe+hnb5MT7S3sZPzj+IgiNpyHYmUnZrIuW0mynjqAWRg7swCYbF3O5/" +
            "YT+ZKoTYKYRouYorfZMyKRxzRvlf9NvKBCFEB98ksKvAd1614c9yNyA/x1H3x9j5WSPuOzoVGc6JlOO0" +
            "ItthRXZrEmW1JFDBpVS6bUU/Xyv4rv/FPdniPiHE+1cCMn0V0TVW9h98t7xj4koZn9IsrdMegWXqVkyy" +
            "1CFu7Hdw68BEGRrWzbi2obxQbDWD/G90MxIqhPgrXzggVGD5W9PQLv8CKSV+e+kVrGqfhay2iZTnNFOO" +
            "Ixm5TivlOCyU3WpWaj9no1E7hvjHAvZhQ2YLIT40Hj4gKPKrYaPmyvScH8iGzR/h6Z91yL1vS/zhPYl9" +
            "f5Z45z2J3/5RYu/vJB7bJVHaILG09Bhm3/szDI9Ll6aAIF8yPhVCFPjc66aEfZAvJtMeHI5P5K8V+Ncu" +
            "PoH844mwt5mpwJFCdoeV1Mo7LMhp1QnIajVT3kkbRj03BCLUSwArp04Wtgb1W9dug+SCzAfw9AtOHGiR" +
            "8tQZKVucEvvel3jtDcLTL7vxw+fc2PmM/vnkC25secyNkjo3lTdIqt4gqWq9pPzlf8HIMZl8L9/7bfbD" +
            "dN3CkXY/X6TLgED58IWVkNKF/7r0IvKPJ2BRWwoVOBl8MuU5kinXYaEch1l9sgtkO8yUczwFsS8Mguhr" +
            "8rWCet9MkjqtErt/+Rk6NImLX0i88y7hsV1u1D6kobhew6o1LhSt1WjVWg1FdRpW8udajVbXulC6zkUl" +
            "9RoV17mouFajikZJVRsk7ln4HEJCuvrGniZ/cNcjHEzUBQZldcfr8gkcof1Ydepu2Nss0Fc+hfIcbPbJ" +
            "0AmweAgwKwKyjyZj4K7+ELGBBgHe1QkM7CKXrNwN53EJlyax9203mh/WUFTrQnGdC2WNLlQ0aFS+TqOK" +
            "dRqVNWgo8WhZg0Zl/Ns6F5XWu6i4XqOSeheV1DIRbqrZJClnyT6EhXX3tYS5/gC/SaZ7TpRDFvfAG3IX" +
            "nr+wDVlHJuHyylspz2GhPKex+noM4O85TgtlOKzo+8M+CBitfPMK08xa9BIOOiUOthC2Pq6hpJ5Bd6Cy" +
            "0UUV61xU3sCqg2Tl/5c0sOrHspY2uFCsCNNQsk6jkjpdV9dqVL1J0tzsX8Jk8t6zXQjRzR/ktSTNeNje" +
            "UyPlAx2rUX0yF7lOMxW02cjuTFHAWXOVBViV/3uDYFsy5n6SiJ47bkHQ7cFXWMCwuAxsf1Ji9x7Cms0u" +
            "lDa6UNngItaKRo1KGz0gG9jMNWJTZ6vw/tagu4dhEUwAE7FaHaNRca2LVq3RqGqjpFF3LPV1vzp/kNeS" +
            "WCGEm0+MuDVMLjycgLxjVrI7bJTrTEGe00qsOc4U5DpSYOfvTAAHQYeZ8o5aaMYHExG1LRrBI68kIHvJ" +
            "W1jzoMTqehd4lct5xdnU+XsDA1YmrVsF/93kRlmTG0yMIqdRJ4CVQRfXszJpbAEujg9MgLusUVLmYidM" +
            "pnCDgBNCiAh/oH9POAVy1fWVMAk5661JKDjN4C8Hvbw2K+W1JZNd/ab7v5EF8o8lk+2dsQh/KAqBQ4K8" +
            "BISEhMsVVcdQ0SxhmDeDVEQYygTwSjdpqNggUb5eoqxJomKjRNUm6Vl1HbjuFh4SahVpKiiyGxTXES2r" +
            "lOjVJ/2mY8Fez0kwPxaHgvNpyHIkg4Mer3iukz+TvfEgl2OBky3AQnntNsT/Og7hG6MQEBPoXf2g4DC5" +
            "rNwpy5ulbt6N7AKasgQmgldXkdDkxsqaDsyc78Qk827cPv5xTEx8Vi7IO6xIKW10e0lgK1htxIF6lSEU" +
            "AazLKyVGjd3p6wY7/EFeS7YagXDUsgGy4OIUnQBnCvLV6jNodgcLKULU33ogzD9ho7GvD0d4QxRMkQG+" +
            "QVDOz3lF1m5hAjwBzuvr+srzCldtkJS3zIWobrOvONdkipbjJm1GxXrDEgw34IDp1tOiygZsCW5aWiYx" +
            "Iek3EEI9A2Ph1v26hSspRUCMuYe0n0kDuwCDZMB5TiaDA6BZD4b8P7YEJqDdRiNfHoqIyiiIgMsA1LX6" +
            "TkBJgxtcvBguwGAM/2atWA/kFwLhkXf6p1BWLLTvQdVGqXzfiBllDW6dxDqdhLIGokUrXRif8N8IDOxq" +
            "ENB6I43TZMN3uvQOlRkHLLAf1wlQMYCzAFsCk8EkqDjAgdFKOUdtGPLcAESsUAWJPwAZ0zcdOfedQsV6" +
            "0iM7BzhefU+AK2siLC6S6NbDdrXzkXzXZtRslobfe+KAig0K/Oq17FKgBfbzGDf5XQQFRRoEHLuRQBgt" +
            "hPjMCIR3vzER+adtYIAGAXosSEGOw6osgeMAp8B7W6zo++M+CM+NuBoApXFjl8jqzbop626g53s26/Jm" +
            "N9h8o3vN/Np5rHOyfoHKjVKP/OocoyZg8DoBhdUaUmaexB0T90AIk0HAJ0KIAH+g15L3DDdI3D5SBcJs" +
            "LwG6Kyh3UEUQN0Vmyj2SjHl/S0KvJ3qhy0zVDn8NAOvQ4dOlMuM6NmOXnu89YCqa3LS8QqJ33/lfO79v" +
            "/xS5fpuGmk0ELomV+XMMURlAU+BL10lauOgMJqecwtDhG3yD4C/9AX6TGHW7HLHkVllwIc3HAqxkbzPi" +
            "AZu/ToD9uI1mfjAZ3b8fjZD40K8BMPTWgWaVDUqUHzP4DuXPqsxtcqOwSiKmb8YV5w+OnS6//6PTePVX" +
            "EuXNeuHDqa9U1QAa6X0C0X1lHUhMO4R42xFERMb5ElDtD/CbpNIbCJO6S/tpm2p7L1vAlWlQFUHHU2H7" +
            "wzh03doDQbHBXwNuaK+YMbKkgVBcx+opc7nWX6cRu8CKaqDfgCWI7DZIjr0zQ1aseQn/81eJ/QckNmzX" +
            "awFPlajMnsEXrXVTYQ0hbbYDiWmfYuiwZl/w5CnwbkhmeQNhjCcQHtOLIRUEHVbKdyYr5YyQ5bDC3p6K" +
            "xDfHIHJjNwT2vlwD+Gu37oMkFziljewGuikbhRCTUFjTgfvLTuLF176QR45LfH5RYt97Eo1bXcr0VTPE" +
            "BNS63CtrXFRUSwr89PTjSEg9g9HjnkdAQKhxP8ZwI2M5rwzzMKcHwl9zIExDHld/eipkMqDUWwOkYfyv" +
            "RiC8JhKmUBV8rqoBAUFy+rwnVTpjV1BdoKcsVjGh0aVK5seeknh8l1sBL1KrrpfPKuWt44pPr/ruK9Uw" +
            "Y8F5JNhOIDZuOwICuviC/1wIMdAf3PUIl8TGMFSaHx2FRZ9NUcWQXgSx6s0QE8Bp0N6ehjG/uA1hheF/" +
            "1/99td+tZuQvew/VmyQ4kBldYHkj9/h6v79qrQc4/6/xckvMxc7yKgn7conUGe0YPe4V9Ow1w/f6ynqF" +
            "EPf6A7sRMUpiGVc4AIsucCbgJshTCrcle0diyiqOp2L4q4MRmvP1DGDqLuQtd3WRcRV9MGH9YAxe0IuP" +
            "QXBApMxf9ieVFZgERQCDbNZQ3uSZDTRpqj/gmkEFygYXlTUSzc7cj159FiMk9DZ1Lb978jyTJ1vfSrYZ" +
            "BPRNi5YF51L1ClAFQD0LZHsJSKbcYzYM2z0QwTNDvA9zS0KonPboHWh0LMFL8nt4S76AzViJvC8sNOXn" +
            "4xDQVaBHj2Fyde1FcAFjEMCA2RJ4QMJk6AR4usR1LqpqdlPzw+eRtWin7B49jO/lSwA/8wZ/MDcjPLVV" +
            "BEQMCJM5rcnIP8oxQFcmQQVF/uTfjtoQ+2J/iLECA6dEyaI9c/Ab+RROyP04LN/F6188ia2flmP50VmU" +
            "2ZpABV+mUPyOEerBp856VNY8YHSKuguUeUArQhi8p2o0LKXuIcIzr0g88YwmZ8z7LkLCYnwt4ZwQYovn" +
            "XcNNi9nwJVOgkJn7bCg8O0uZu3ID1RIb9YCV7EeSKeHNEbhv3914X74GtzwHJ32IH59fj8L2u5HdFk8L" +
            "HZP02WGLmTIdiZRxzExhg02I6ZkoudFh0+bVLlrbgeJ6QkWjW2+aPKvP3xVBnlhQuV7DUy9K/OkvEjt+" +
            "1I4JCct80x8rF3S3+QO7XuE3vxcNK5jzbBKatCVqOsQ1gD4PYDK4KdKt4DunrLRdK8WeL5/FlrOrsfh4" +
            "CnKPJHjrhtxWq1ImYOHBBMo6Z6XBi6JhEl1wf9kJVDRJKmsmLC7+DFPv+RjljZKDn2qaShr1noFVzQ4b" +
            "NarkSVK9Rtt2avjbIYkP9kvcv3ovonootzCI4D6As9pNiTG/l/HVI+RO2YCCthTkO21qOMrRX+8NdEJ4" +
            "bph3JIkyj9xJOc54dYx+LGuyPjhpsVDWYTOlH0yg7LPJNKKqvzLd/OXvo5I7xUYekhIG3lYjZ877SG+B" +
            "eX7gCYSKBM+MkC2higmqc1HtAy78/l3gkxaJhoc+xcCh0wyX4OfnSbfvu4nrlpcNAgbNicYLcitKTyxU" +
            "gxGdAM+YzBMHeGaou4YnUKoJcoreMrdaKafFQpmHkyj9YCItOJhAC9qTqEeu6hxhv/89Bba0gU1b0sjb" +
            "69E1KkkuLZFY+yCpURq7gpoHKIvQg6M+RdYnxUzQT3e78fO9EkW1XyK61wRfl2j0B3c9wifpgXBEIJ53" +
            "bcX3zlcjpy3BY9KcFnkkpr8bMFwht1XvEVSbrEzeQpmHkpQq8IcSKbPNQqN/cRtEnECIiMCyihOqOuS8" +
            "z65gnfaGImbk7Vt4hgBuhHjqoxonbqGbNKVqtGb0Eus04vcIFc0uVG+UZJvJQxFvR3jyRlpiQxZ4A0qY" +
            "kI+0VGIvPYvcowmwczGkSDB7CWDghpmzn6tgdyiJMg4m0sIDCWrVM51JtOCQGaNfiUVQSQREsMCggVNU" +
            "ZVi6zk2l9W53eZOkGemfQJh4rmiS5tTfy03bJLY8yiRoxASo2SDPEfi7ZzJsKHeGq2tBMxZ8jrDw4b5B" +
            "0eIP8JtkhI8fyaW/mo1D8o8oPjWXX5SQXQW1yy9H2MSVj7eYKYtX/GASLeQVP5BAGa1mWugwU/LvxlKf" +
            "HX0QzGOzUWpwinT761izSepve+o0N7e1M9NPIji4lwpmYV0Gy7vmnMG2nRLf/zGPw3iA4lLzwMsTYv1l" +
            "iT4YddOSkg5Y7zqLbj2svm6Q7Q/wm4TzqLcktmwagU/k23j+821Id4xHbouZchhsC78Z1jXjkA46/UAi" +
            "pbOpOyyU3mKh5LfHYuAP+iF0YxSCyiNhitPBj5+8XIHXV05/3bVqDWjK7HPoEh7rLXB69p4hZ2dKPPYT" +
            "fklqvCrz9AX1+licf1tRxR2jpNlZpzHJ2obwiBG+GeGmSuM3DAJuSQqXO2UNnPJDbDtTjYyWBMo4lEAZ" +
            "h5No4aFEyjiUqMDzamc4rXTP/gRM3hOHWx/th9CmrgiqiUTw/HCIbsqqMD5+pRqVlzeQd6TFq1ewooOS" +
            "0k4iPEKZr1cHDi2R83MldjxJ2PmsG3z8ikqNVtYo4HR/uZuK6yQWrTqPhNRTGDPhNZhM3sEo61h/cNcj" +
            "NQYBrImPxmKX3IAP5Jt4teOHWHpsBmU64ym7jUFbaM5fE9RqD392CHps7YmQ9ZEIqoxE8LxwBPTTVz1Q" +
            "9MLy4pewYbtEYTVUcCtawyvvpsJqN+6aexaTrH9DULDaB+CrGHH7w5iTLbHxEcITz7nRtNWN0gZWQvUm" +
            "YEnxWSRNaUO8rR1R3Sb7mj/vNrmpbTaDfXaKSBEi5PAtMXLOR/Gwf3g3pv9pIixvjca43cMw5Cf9Eb39" +
            "FoSxma+JQPDSCAQlh8HU48oReXTvuajdLPH0y8DazTwZIjXMXFntwvT5x5E05UvEjnrEa/4+K+ghYTum" +
            "zZNYvFJi7aZLWLPpIgqrzmFu9jHE205icnIbesUs8D//W+0b4G1xvg8hg61BiFgdhoj6SITVRSK4MgKB" +
            "K7ogOC8cwbYwBPRTb4f9H0KdHxwSjZTpH6OwUqKq2Y2iNZdgX/4Zpsw+haS0Sxg36U0EB/f0Pe+sEOI/" +
            "fe/fb2ABJlo+hnnql0hKu4AJ5tM0PqmV4sa+gMio8f735HrmW4lJCPGSPwmsAd0DZEBMIEzdAyCCLv/u" +
            "9wCsX/r8hvCIAfKOiT9F0l2nYJ3GA42TuDPxAwyJbTLm+b7nc3fHU12jRVfPEBAQJrtH22Sffnm4JWYB" +
            "wiNGXo1wHoiG+wO6GWESHroKsGspu847nqEkNyVLfAGwhob1lVHd75SRXccgMPCKYYpx3G6flxqclXiX" +
            "mP99rvZMPBNgy+Xn/ofKeCHE455dXfrY7LKyqXIHxhuW2OeuNoxc6hlV+T+wv14SQmz8OwDmebbRGbHJ" +
            "V/m5eJbBW3f/qcI7vbjL4jdJvL9v9A1skR3q2cfDzRYDNR6eiWEC2eSvp4Njq+IBrl0Ike7Z3fatZgD/" +
            "FzLAs4mK9xPyrtRO6ZRO6ZRO6ZRO6ZR/uvwvR1428rHOZWoAAAAASUVORK5CYII=";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            notifyIcon = new NotifyIcon();
            notifyIcon.Text = "LyricsRPC";

            try
            {
                byte[] pngBytes = Convert.FromBase64String(ICON_PNG_B64);
                using (MemoryStream ms = new MemoryStream(pngBytes))
                {
                    _iconBmp = new Bitmap(ms);
                }
                Bitmap pargb = new Bitmap(_iconBmp.Width, _iconBmp.Height, PixelFormat.Format32bppPArgb);
                using (Graphics g = Graphics.FromImage(pargb))
                {
                    g.DrawImage(_iconBmp, 0, 0, pargb.Width, pargb.Height);
                }
                IntPtr hIcon = pargb.GetHicon();
                notifyIcon.Icon = (Icon)Icon.FromHandle(hIcon).Clone();
                DestroyIcon(hIcon);
                pargb.Dispose();
            }
            catch
            {
                notifyIcon.Icon = SystemIcons.Application;
            }

            ContextMenuStrip menu = new ContextMenuStrip();
            ToolStripMenuItem openItem = new ToolStripMenuItem("Otwórz LyricsRPC");
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            openItem.Click += (s, e) => { Console.WriteLine("ACTION:OPEN"); };

            ToolStripMenuItem exitItem = new ToolStripMenuItem("Wyłącz");
            exitItem.Click += (s, e) =>
            {
                Console.WriteLine("ACTION:EXIT");
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
                Application.Exit();
            };

            menu.Items.Add(openItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exitItem);

            notifyIcon.ContextMenuStrip = menu;
            notifyIcon.MouseClick += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    Console.WriteLine("ACTION:OPEN");
                }
            };
            notifyIcon.DoubleClick += (s, e) => { Console.WriteLine("ACTION:OPEN"); };

            notifyIcon.Visible = true;

            new Thread(() =>
            {
                try
                {
                    while (Console.ReadLine() != null) { }
                }
                catch { }
                try
                {
                    notifyIcon.Visible = false;
                    notifyIcon.Dispose();
                }
                catch { }
                Environment.Exit(0);
            })
            { IsBackground = true }.Start();

            Application.Run();
        }
    }
}

